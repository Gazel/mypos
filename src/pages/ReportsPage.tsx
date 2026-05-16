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
type DailyRangeMode = "thisMonth" | "lastMonth" | "custom";
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

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getDailyPresetRange(mode: Exclude<DailyRangeMode, "custom">) {
  const today = new Date();

  if (mode === "lastMonth") {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      startDate: toInputDate(startOfMonth(previousMonth)),
      endDate: toInputDate(endOfMonth(previousMonth)),
    };
  }

  return {
    startDate: toInputDate(startOfMonth(today)),
    endDate: toInputDate(today),
  };
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
  const defaultDailyRange = useMemo(
    () => getDailyPresetRange("thisMonth"),
    []
  );
  const defaultUsageRange = useMemo(() => getUsagePresetRange("today"), []);

  const [activeTab, setActiveTab] = useState<ReportTab>(() => {
    const savedTab = localStorage.getItem(reportTabStorageKey);
    return savedTab === "usage" ? "usage" : "daily";
  });
  const [dailyRangeMode, setDailyRangeMode] =
    useState<DailyRangeMode>("thisMonth");
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
    if (dailyRangeMode === "custom") {
      return {
        startDate: dailyCustomStart,
        endDate: dailyCustomEnd,
      };
    }

    return getDailyPresetRange(dailyRangeMode);
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

  const dailyTotals = useMemo(() => {
    return dailyRows.reduce(
      (totals, row) => ({
        transactionCount: totals.transactionCount + row.transactionCount,
        totalSales: totals.totalSales + row.totalSales,
        totalCash: totals.totalCash + row.totalCash,
        totalQris: totals.totalQris + row.totalQris,
      }),
      {
        transactionCount: 0,
        totalSales: 0,
        totalCash: 0,
        totalQris: 0,
      }
    );
  }, [dailyRows]);

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
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex w-full items-end justify-end gap-2">
        <label className="min-w-0 flex-1 text-sm sm:w-40 sm:flex-none">
          <span className="block text-xs text-gray-500 mb-1">Periode</span>
          <select
            value={dailyRangeMode}
            onChange={(e) => setDailyRangeMode(e.target.value as DailyRangeMode)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="thisMonth">Bulan ini</option>
            <option value="lastMonth">Bulan kemarin</option>
            <option value="custom">Custom date</option>
          </select>
        </label>

        <button
          onClick={loadDailySummary}
          disabled={isDailyLoading || isDailyRangeInvalid}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          title="Refresh daily summary"
          aria-label="Refresh daily summary"
        >
          <RefreshCw size={15} className={isDailyLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {dailyRangeMode === "custom" && (
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
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
    </div>
  );

  const renderUsageControls = () => (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="flex w-full items-end justify-end gap-2">
        <label className="min-w-0 flex-1 text-sm sm:w-40 sm:flex-none">
          <span className="block text-xs text-gray-500 mb-1">Periode</span>
          <select
            value={usageRangeMode}
            onChange={(e) => setUsageRangeMode(e.target.value as UsageRangeMode)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="today">Hari ini</option>
            <option value="yesterday">Kemarin</option>
            <option value="thisWeek">Minggu ini</option>
            <option value="thisMonth">Bulan ini</option>
            <option value="custom">Custom date</option>
          </select>
        </label>

        <button
          onClick={loadRecipeUsageReport}
          disabled={isUsageLoading || isUsageRangeInvalid}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          title="Refresh report usage"
          aria-label="Refresh report usage"
        >
          <RefreshCw size={15} className={isUsageLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {usageRangeMode === "custom" && (
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
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
    </div>
  );

  const renderDailySummary = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[74px]">
          <div className="text-xs text-gray-600 dark:text-gray-300">
            Total Transaksi
          </div>
          <div className="text-lg font-bold mt-1">
            {dailyTotals.transactionCount}
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 min-h-[74px]">
          <div className="text-xs text-amber-700 dark:text-amber-300">
            Total Penjualan
          </div>
          <div className="text-lg font-bold mt-1 break-words">
            {formatCurrency(dailyTotals.totalSales)}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 min-h-[74px]">
          <div className="text-xs text-green-700 dark:text-green-300">
            Total Cash
          </div>
          <div className="text-lg font-bold mt-1 break-words">
            {formatCurrency(dailyTotals.totalCash)}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 min-h-[74px]">
          <div className="text-xs text-blue-700 dark:text-blue-300">
            Total QRIS
          </div>
          <div className="text-lg font-bold mt-1 break-words">
            {formatCurrency(dailyTotals.totalQris)}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {dailyErrorMessage ? (
          <div className="text-center text-red-600 dark:text-red-300 py-10">
            {dailyErrorMessage}
          </div>
        ) : isDailyLoading ? (
          <div className="text-center text-gray-500 py-10">Memuat...</div>
        ) : (
          <div className="fit-table-wrap">
            <table className="fit-table divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="w-[34%] text-left">Hari & Tanggal</th>
                  <th className="w-[14%] fit-table-number">Transaksi</th>
                  <th className="w-[17%] fit-table-number">Cash</th>
                  <th className="w-[17%] fit-table-number">QRIS</th>
                  <th className="w-[18%] fit-table-number">Penjualan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {dailyRows.map((row) => (
                  <tr
                    key={row.date}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <td>
                      <div className="font-medium">{formatDayLabel(row.date)}</div>
                    </td>
                    <td className="fit-table-number font-semibold">
                      {row.transactionCount}
                    </td>
                    <td className="fit-table-number">
                      {formatCurrency(row.totalCash)}
                    </td>
                    <td className="fit-table-number">
                      {formatCurrency(row.totalQris)}
                    </td>
                    <td className="fit-table-number font-semibold">
                      {formatCurrency(row.totalSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
              <div className="fit-table-wrap">
                <table className="fit-table divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="w-[25%] text-left">
                        Bahan
                      </th>
                      <th className="w-[18%] fit-table-number">
                        Qty Base
                      </th>
                      <th className="w-[18%] fit-table-number">
                        Qty Display
                      </th>
                      <th className="w-[20%] fit-table-number">
                        Harga Rata-rata
                      </th>
                      <th className="w-[19%] fit-table-number">
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
                        <td className="font-medium">
                          {row.ingredientName}
                        </td>
                        <td className="fit-table-number">
                          {formatQty(row.usedBaseQty, row.baseUnit)}
                        </td>
                        <td className="fit-table-number">
                          {formatQty(row.usedDisplayQty, row.displayUnit)}
                        </td>
                        <td className="fit-table-number">
                          {formatCurrency(row.pricePerDisplayUnit)}
                        </td>
                        <td className="fit-table-number font-semibold">
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
              <div className="fit-table-wrap">
                <table className="fit-table divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="w-[24%] text-left">
                        Produk
                      </th>
                      <th className="w-[13%] fit-table-number">
                        Qty Terjual
                      </th>
                      <th className="w-[18%] fit-table-number">
                        Total Penjualan
                      </th>
                      <th className="w-[16%] fit-table-number">
                        HPP per Produk
                      </th>
                      <th className="w-[17%] fit-table-number">
                        Total HPP
                      </th>
                      <th className="w-[12%] fit-table-number">
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
                        <td className="font-medium">
                          {row.productName}
                        </td>
                        <td className="fit-table-number">
                          {formatNumber(row.soldQty, 4)}
                        </td>
                        <td className="fit-table-number font-semibold">
                          {formatCurrency(row.totalSales)}
                        </td>
                        <td className="fit-table-number">
                          {formatCurrency(row.estimatedHppPerProduct)}
                        </td>
                        <td className="fit-table-number font-semibold">
                          {formatCurrency(row.totalEstimatedHpp)}
                        </td>
                        <td className="fit-table-number">
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
