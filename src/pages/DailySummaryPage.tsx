import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchDailySalesSummaryOnline,
  subscribeTransactionsOnline,
  type DailySalesSummaryRow,
} from "../services/apiBackend";
import type { Transaction } from "../types";
import { formatCurrency } from "../utils/formatter";

type RangeMode = "30" | "60" | "custom";

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

function presetRange(days: number) {
  const end = new Date();
  const start = addDays(end, -(days - 1));
  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
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

const DailySummaryPage: React.FC = () => {
  const { token } = useAuth();
  const defaultRange = useMemo(() => presetRange(30), []);
  const [rangeMode, setRangeMode] = useState<RangeMode>("30");
  const [customStart, setCustomStart] = useState(defaultRange.startDate);
  const [customEnd, setCustomEnd] = useState(defaultRange.endDate);
  const [summaryRows, setSummaryRows] = useState<DailySalesSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeRange = useMemo(() => {
    if (rangeMode === "60") return presetRange(60);
    if (rangeMode === "custom") {
      return {
        startDate: customStart,
        endDate: customEnd,
      };
    }

    return presetRange(30);
  }, [customEnd, customStart, rangeMode]);

  const isRangeInvalid =
    !activeRange.startDate ||
    !activeRange.endDate ||
    activeRange.startDate > activeRange.endDate;

  const loadSummary = useCallback(async () => {
    if (!token) return;

    if (isRangeInvalid) {
      setSummaryRows([]);
      setErrorMessage("Tanggal mulai harus lebih awal dari tanggal akhir.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await fetchDailySalesSummaryOnline(token, activeRange);
      setSummaryRows(data);
    } catch (error) {
      console.error(error);
      setErrorMessage("Gagal memuat daily summary.");
      setSummaryRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeRange, isRangeInvalid, token]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!token || isRangeInvalid) return;

    const source = subscribeTransactionsOnline(
      token,
      (trx) => {
        const dateKey = dateKeyFromTransaction(trx.date);
        if (
          isSuccessTransaction(trx) &&
          dateKey >= activeRange.startDate &&
          dateKey <= activeRange.endDate
        ) {
          void loadSummary();
        }
      },
      () => console.warn("Transaction stream disconnected")
    );

    return () => source.close();
  }, [activeRange, isRangeInvalid, loadSummary, token]);

  const dailyRows = useMemo(() => {
    const rowMap = new Map(summaryRows.map((row) => [row.date, row]));

    return getDateKeysDescending(
      activeRange.startDate,
      activeRange.endDate
    ).map((date) => rowMap.get(date) ?? emptySummary(date));
  }, [activeRange, summaryRows]);

  return (
    <div className="container mx-auto px-4 py-5 md:py-6">
      <div className="flex flex-col gap-4 mb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Daily Summary</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeRange.startDate} sampai {activeRange.endDate}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <label className="text-sm">
            <span className="block text-xs text-gray-500 mb-1">Periode</span>
            <select
              value={rangeMode}
              onChange={(e) => setRangeMode(e.target.value as RangeMode)}
              className="w-full sm:w-44 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="30">30 hari terakhir</option>
              <option value="60">60 hari terakhir</option>
              <option value="custom">Custom date</option>
            </select>
          </label>

          {rangeMode === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">
                  Mulai
                </span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">
                  Sampai
                </span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                />
              </label>
            </div>
          )}

          <button
            onClick={loadSummary}
            disabled={isLoading || isRangeInvalid}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {errorMessage ? (
          <div className="text-center text-red-600 dark:text-red-300 py-10">
            {errorMessage}
          </div>
        ) : isLoading ? (
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
                      <div className="font-medium">
                        {formatDayLabel(row.date)}
                      </div>
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
    </div>
  );
};

export default DailySummaryPage;
