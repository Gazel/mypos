import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchDailySalesSummaryOnline,
  fetchRecipeUsageReportOnline,
  subscribeTransactionsOnline,
  type DailySalesSummaryRow,
} from "../services/apiBackend";
import type { RecipeUsageReport, Transaction } from "../types";
import { formatCurrency } from "../utils/formatter";

type ReportTab = "daily" | "usage";
type DailyRangeMode = "30" | "60" | "custom";
type UsageRangeMode =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "custom";

const reportTabStorageKey = "mypos_report_tab";

function toInputDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function presetDailyRange(days: number) {
  const end = new Date();
  const start = addDays(end, -(days - 1));
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getUsagePresetRange(mode: Exclude<UsageRangeMode, "custom">) {
  const today = new Date();

  if (mode === "today") {
    return {
      startDate: toInputDate(today),
      endDate: toInputDate(today),
    };
  }

  if (mode === "yesterday") {
    const yesterday = addDays(today, -1);
    return {
      startDate: toInputDate(yesterday),
      endDate: toInputDate(yesterday),
    };
  }

  if (mode === "thisWeek") {
    return {
      startDate: toInputDate(startOfWeek(today)),
      endDate: toInputDate(today),
    };
  }

  if (mode === "thisMonth") {
    return {
      startDate: toInputDate(startOfMonth(today)),
      endDate: toInputDate(today),
    };
  }

  return {
    startDate: toInputDate(today),
    endDate: toInputDate(today),
  };
}

function dateKeyToDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeyFromTransaction(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return toInputDate(d);
}

function getDateKeysDescending(startDate: string, endDate: string) {
  if (!startDate || !endDate || startDate > endDate) return [];

  const keys: string[] = [];
  let cursor = dateKeyToDate(endDate);
  const start = dateKeyToDate(startDate);

  while (cursor >= start) {
    keys.push(toInputDate(cursor));
    cursor = addDays(cursor, -1);
  }

  return keys;
}

function formatDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dateKeyToDate(dateKey));
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
  }).format(value);
}

function formatPercent(value: number) {
  return `${formatNumber(value, 2)}%`;
}

function formatQty(value: number, unit: string) {
  return `${formatNumber(value, 4)} ${unit}`;
}

function isSuccessTransaction(trx: Transaction) {
  return (
    (trx.status || "SUCCESS") === "SUCCESS" &&
    trx.paymentMethod !== "cancelled"
  );
}

const emptySummary = (date: string): DailySalesSummaryRow => ({
  date,
  transactionCount: 0,
  totalSales: 0,
  totalCash: 0,
  totalQris: 0,
});

const ReportsPage: React.FC = () => {
  const { token } = useAuth();
  const defaultDailyRange = useMemo(() => presetDailyRange(30), []);
  const defaultUsageRange = useMemo(() => getUsagePresetRange("today"), []);

  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    const savedTab = localStorage.getItem(reportTabStorageKey);
    return savedTab === "usage" ? "usage" : "daily";
  });
  const [dailyRangeMode, setDailyRangeMode] =
    useState<DailyRangeMode>("30");
  const [dailyCustomStart, setDailyCustomStart] = useState(
    defaultDailyRange.startDate
  );
  const [dailyCustomEnd, setDailyCustomEnd] = useState(
    defaultDailyRange.endDate
  );
  const [usageRangeMode, setUsageRangeMode] =
    useState<UsageRangeMode>("today");
  const [usageCustomStart, setUsageCustomStart] = useState(
    defaultUsageRange.startDate
  );
  const [usageCustomEnd, setUsageCustomEnd] = useState(
    defaultUsageRange.endDate
  );
  const [summaryRows, setSummaryRows] = useState<DailySalesSummaryRow[]>([]);
  const [recipeUsageReport, setRecipeUsageReport] =
    useState<RecipeUsageReport | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [dailyErrorMessage, setDailyErrorMessage] = useState("");
  const [usageErrorMessage, setUsageErrorMessage] = useState("");

  const dailyRange = useMemo(() => {
    if (dailyRangeMode === "60") return presetDailyRange(60);
    if (dailyRangeMode === "custom") {
      return {
        startDate: dailyCustomStart,
        endDate: dailyCustomEnd,
      };
    }

    return presetDailyRange(30);
  }, [dailyCustomEnd, dailyCustomStart, dailyRangeMode]);

  const usageRange = useMemo(() => {
    if (usageRangeMode === "custom") {
      return {
        startDate: usageCustomStart,
        endDate: usageCustomEnd,
      };
    }

    return getUsagePresetRange(usageRangeMode);
  }, [usageCustomEnd, usageCustomStart, usageRangeMode]);

  const isDailyRangeInvalid =
    !dailyRange.startDate ||
    !dailyRange.endDate ||
    dailyRange.startDate > dailyRange.endDate;

  const isUsageRangeInvalid =
    !usageRange.startDate ||
    !usageRange.endDate ||
    usageRange.startDate > usageRange.endDate;

  const loadDailySummary = useCallback(async () => {
    if (!token) return;

    if (isDailyRangeInvalid) {
      setSummaryRows([]);
      setDailyErrorMessage("Tanggal mulai harus lebih awal dari tanggal akhir.");
      return;
    }

    setIsDailyLoading(true);
    setDailyErrorMessage("");
    try {
      const data = await fetchDailySalesSummaryOnline(token, dailyRange);
      setSummaryRows(data);
    } catch (error) {
      console.error(error);
      setDailyErrorMessage("Gagal memuat daily summary.");
      setSummaryRows([]);
    } finally {
      setIsDailyLoading(false);
    }
  }, [dailyRange, isDailyRangeInvalid, token]);

  const loadRecipeUsageReport = useCallback(async () => {
    if (!token) return;

    if (isUsageRangeInvalid) {
      setRecipeUsageReport(null);
      setUsageErrorMessage("Tanggal mulai harus lebih awal dari tanggal akhir.");
      return;
    }

    setIsUsageLoading(true);
    setUsageErrorMessage("");
    try {
      const data = await fetchRecipeUsageReportOnline(token, usageRange);
      setRecipeUsageReport(data);
    } catch (error) {
      console.error(error);
      setUsageErrorMessage("Gagal memuat report usage.");
      setRecipeUsageReport(null);
    } finally {
      setIsUsageLoading(false);
    }
  }, [isUsageRangeInvalid, token, usageRange]);

  useEffect(() => {
    if (activeTab !== "daily") return;
    void loadDailySummary();
  }, [activeTab, loadDailySummary]);

  useEffect(() => {
    if (activeTab !== "usage") return;
    void loadRecipeUsageReport();
  }, [activeTab, loadRecipeUsageReport]);

  useEffect(() => {
    if (!token || activeTab !== "daily" || isDailyRangeInvalid) return;

    const source = subscribeTransactionsOnline(
      token,
      (trx) => {
        const dateKey = dateKeyFromTransaction(trx.date);
        if (
          isSuccessTransaction(trx) &&
          dateKey >= dailyRange.startDate &&
          dateKey <= dailyRange.endDate
        ) {
          void loadDailySummary();
        }
      },
      () => console.warn("Transaction stream disconnected")
    );

    return () => source.close();
  }, [activeTab, dailyRange, isDailyRangeInvalid, loadDailySummary, token]);

  useEffect(() => {
    if (!token || activeTab !== "usage" || isUsageRangeInvalid) return;

    const source = subscribeTransactionsOnline(
      token,
      (trx) => {
        const dateKey = dateKeyFromTransaction(trx.date);
        if (
          isSuccessTransaction(trx) &&
          dateKey >= usageRange.startDate &&
          dateKey <= usageRange.endDate
        ) {
          void loadRecipeUsageReport();
        }
      },
      () => console.warn("Transaction stream disconnected")
    );

    return () => source.close();
  }, [
    activeTab,
    isUsageRangeInvalid,
    loadRecipeUsageReport,
    token,
    usageRange,
  ]);

  const dailyRows = useMemo(() => {
    const rowMap = new Map(summaryRows.map((row) => [row.date, row]));

    return getDateKeysDescending(dailyRange.startDate, dailyRange.endDate).map(
      (date) => rowMap.get(date) ?? emptySummary(date)
    );
  }, [dailyRange, summaryRows]);

  const ingredientUsageRows = useMemo(() => {
    return [...(recipeUsageReport?.ingredientUsage ?? [])].sort(
      (a, b) => b.estimatedHpp - a.estimatedHpp
    );
  }, [recipeUsageReport]);

  const productUsageRows = useMemo(() => {
    return [...(recipeUsageReport?.productUsage ?? [])].sort(
      (a, b) => b.totalEstimatedHpp - a.totalEstimatedHpp
    );
  }, [recipeUsageReport]);

  const selectTab = (tab: ReportTab) => {
    setActiveTab(tab);
    localStorage.setItem(reportTabStorageKey, tab);
  };

  const renderDailyControls = () => (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
      <label className="text-sm">
        <span className="block text-xs text-gray-500 mb-1">Periode</span>
        <select
          value={dailyRangeMode}
          onChange={(e) => setDailyRangeMode(e.target.value as DailyRangeMode)}
          className="w-full sm:w-44 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="30">30 hari terakhir</option>
          <option value="60">60 hari terakhir</option>
          <option value="custom">Custom date</option>
        </select>
      </label>

      {dailyRangeMode === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="block text-xs text-gray-500 mb-1">Mulai</span>
            <input
              type="date"
              value={dailyCustomStart}
              onChange={(e) => setDailyCustomStart(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-500 mb-1">Sampai</span>
            <input
              type="date"
              value={dailyCustomEnd}
              onChange={(e) => setDailyCustomEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </label>
        </div>
      )}

      <button
        onClick={loadDailySummary}
        disabled={isDailyLoading || isDailyRangeInvalid}
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw size={15} className={isDailyLoading ? "animate-spin" : ""} />
        Refresh
      </button>
    </div>
  );

  const renderUsageControls = () => (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
      <label className="text-sm">
        <span className="block text-xs text-gray-500 mb-1">Periode</span>
        <select
          value={usageRangeMode}
          onChange={(e) => setUsageRangeMode(e.target.value as UsageRangeMode)}
          className="w-full sm:w-44 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="today">Hari ini</option>
          <option value="yesterday">Kemarin</option>
          <option value="thisWeek">Minggu ini</option>
          <option value="thisMonth">Bulan ini</option>
          <option value="custom">Custom date</option>
        </select>
      </label>

      {usageRangeMode === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="block text-xs text-gray-500 mb-1">Mulai</span>
            <input
              type="date"
              value={usageCustomStart}
              onChange={(e) => setUsageCustomStart(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-gray-500 mb-1">Sampai</span>
            <input
              type="date"
              value={usageCustomEnd}
              onChange={(e) => setUsageCustomEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </label>
        </div>
      )}

      <button
        onClick={loadRecipeUsageReport}
        disabled={isUsageLoading || isUsageRangeInvalid}
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <RefreshCw size={15} className={isUsageLoading ? "animate-spin" : ""} />
        Refresh
      </button>
    </div>
  );

  const renderDailySummary = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {dailyErrorMessage ? (
        <div className="text-center text-red-600 dark:text-red-300 py-10">
          {dailyErrorMessage}
        </div>
      ) : isDailyLoading ? (
        <div className="text-center text-gray-500 py-10">Memuat...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-gray-500">
                  Hari & Tanggal
                </th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">
                  Total Transaksi
                </th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">
                  Total Cash
                </th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">
                  Total QRIS
                </th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">
                  Total Penjualan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {dailyRows.map((row) => (
                <tr
                  key={row.date}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{formatDayLabel(row.date)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">
                    {row.transactionCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency(row.totalCash)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency(row.totalQris)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold">
                    {formatCurrency(row.totalSales)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderUsageReport = () => {
    if (usageErrorMessage) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center text-red-600 dark:text-red-300 py-10">
          {usageErrorMessage}
        </div>
      );
    }

    if (isUsageLoading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center text-gray-500 py-10">
          Memuat...
        </div>
      );
    }

    if (!recipeUsageReport) return null;

    const hasUsageData =
      recipeUsageReport.summary.transactionCount > 0 ||
      ingredientUsageRows.length > 0 ||
      productUsageRows.length > 0;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 min-h-[78px]">
            <div className="text-xs text-gray-500">Total Penjualan</div>
            <div className="text-lg font-bold mt-1 break-words">
              {formatCurrency(recipeUsageReport.summary.totalSales)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 min-h-[78px]">
            <div className="text-xs text-gray-500">Estimasi HPP</div>
            <div className="text-lg font-bold mt-1 break-words">
              {formatCurrency(recipeUsageReport.summary.estimatedHpp)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 min-h-[78px]">
            <div className="text-xs text-gray-500">Estimasi Laba Kotor</div>
            <div className="text-lg font-bold mt-1 break-words">
              {formatCurrency(recipeUsageReport.summary.estimatedGrossProfit)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 min-h-[78px]">
            <div className="text-xs text-gray-500">Estimasi Margin</div>
            <div className="text-lg font-bold mt-1">
              {formatPercent(recipeUsageReport.summary.estimatedMargin)}
            </div>
          </div>
        </div>

        {recipeUsageReport.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
              <AlertTriangle size={16} />
              Data perlu dilengkapi
            </div>
            <div className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
              {recipeUsageReport.warnings.map((warning, index) => (
                <div key={`${warning.type}-${index}`}>
                  {warning.productName || warning.ingredientName || "-"}:{" "}
                  {warning.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasUsageData ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center text-gray-500 py-10">
            Belum ada transaksi sukses pada periode ini.
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold">
                Usage Bahan
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">
                        Bahan
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Qty Base
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Qty Display
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Harga Rata-rata
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Estimasi HPP
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {ingredientUsageRows.map((row) => (
                      <tr
                        key={row.ingredientId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {row.ingredientName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatQty(row.usedBaseQty, row.baseUnit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatQty(row.usedDisplayQty, row.displayUnit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatCurrency(row.pricePerDisplayUnit)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {formatCurrency(row.estimatedHpp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-semibold">
                Usage Produk
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">
                        Produk
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Qty Terjual
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Total Penjualan
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        HPP per Produk
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Total HPP
                      </th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {productUsageRows.map((row) => (
                      <tr
                        key={row.productId || row.productName}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {row.productName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatNumber(row.soldQty, 4)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {formatCurrency(row.totalSales)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatCurrency(row.estimatedHppPerProduct)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {formatCurrency(row.totalEstimatedHpp)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          {formatPercent(row.estimatedMargin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-5 md:py-6">
      <div className="flex flex-col gap-4 mb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeTab === "daily"
              ? `${dailyRange.startDate} sampai ${dailyRange.endDate}`
              : `${usageRange.startDate} sampai ${usageRange.endDate}`}
          </p>
        </div>

        {activeTab === "daily" ? renderDailyControls() : renderUsageControls()}
      </div>

      <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden mb-4 bg-white dark:bg-gray-800">
        <button
          onClick={() => selectTab("daily")}
          className={`px-3 py-2 text-sm ${
            activeTab === "daily"
              ? "bg-blue-600 text-white"
              : "text-gray-700 dark:text-gray-200"
          }`}
        >
          Daily Summary
        </button>
        <button
          onClick={() => selectTab("usage")}
          className={`px-3 py-2 text-sm border-l border-gray-300 dark:border-gray-700 ${
            activeTab === "usage"
              ? "bg-blue-600 text-white"
              : "text-gray-700 dark:text-gray-200"
          }`}
        >
          Report Usage
        </button>
      </div>

      {activeTab === "daily" ? renderDailySummary() : renderUsageReport()}
    </div>
  );
};

export default ReportsPage;
