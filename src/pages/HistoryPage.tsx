// src/pages/HistoryPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  CalendarIcon,
  Eye,
  ArrowDownUp,
  Download,
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency, formatDateHistory } from "../utils/formatter";
import Modal from "../components/UI/Modal";
import { useModal } from "../components/UI/useModal";
import Receipt from "../components/POS/Receipt";
import type { CartItem, Transaction } from "../types";
import {
  fetchTransactionsOnline,
  subscribeTransactionsOnline,
} from "../services/apiBackend";

type SortField = "date" | "total" | "items";

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function toInputDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

const HistoryPage: React.FC = () => {
  const { transactions, reloadTransactions } = useCart();
  const { token } = useAuth();
  const { isOpen, openModal, closeModal } = useModal();

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  // ================================
  // FILTERS — default: TODAY
  // ================================
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState<string>(() => todayInputValue());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token || !dateFilter) return;

    let cancelled = false;
    setIsLoading(true);

    reloadTransactions({ date: dateFilter }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token, dateFilter, reloadTransactions]);

  useEffect(() => {
    if (!token || !dateFilter) return;

    const source = subscribeTransactionsOnline(
      token,
      (trx) => {
        if (toInputDate(trx.date) === dateFilter) {
          reloadTransactions({ date: dateFilter });
        }
      },
      () => console.warn("Transaction stream disconnected")
    );

    return () => source.close();
  }, [token, dateFilter, reloadTransactions]);

  // ================================
  // SORTING
  // ================================
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // ================================
  // DOWNLOAD RANGE
  // ================================
  const [showDownload, setShowDownload] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // ================================
  // FILTERED TRANSACTIONS (auto updates)
  // ================================
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((trx) => {
        const searchLower = searchTerm.toLowerCase();

        // search by ID
        if (searchTerm && !String(trx.id).toLowerCase().includes(searchLower))
          return false;

        return true;
      })
      .sort((a, b) => {
        let v = 0;
        if (sortField === "date")
          v = new Date(a.date).getTime() - new Date(b.date).getTime();
        else if (sortField === "total") v = a.total - b.total;
        else if (sortField === "items") v = a.items.length - b.items.length;

        return sortDirection === "asc" ? v : -v;
      });
  }, [transactions, searchTerm, sortField, sortDirection]);

  // ================================
  // SUMMARY TOTALS
  // ================================
  const { successCount, totalCash, totalQris, totalSales } = useMemo(() => {
    let count = 0;
    let cash = 0;
    let qris = 0;
    let sales = 0;

    filteredTransactions.forEach((trx) => {
      const cancelled =
        trx.status === "CANCELLED" || trx.paymentMethod === "cancelled";
      if (cancelled) return;

      count += 1;
      sales += trx.total;
      if (trx.paymentMethod === "cash") cash += trx.total;
      if (trx.paymentMethod === "qris") qris += trx.total;
    });

    return {
      successCount: count,
      totalCash: cash,
      totalQris: qris,
      totalSales: sales,
    };
  }, [filteredTransactions]);

  const viewTransaction = (trx: Transaction) => {
    setSelectedTransaction(trx);
    openModal();
  };

  const renderPaymentLabel = (trx: Transaction) => {
    if (trx.status === "CANCELLED" || trx.paymentMethod === "cancelled")
      return "Cancelled";

    return trx.paymentMethod === "cash"
      ? "Tunai"
      : trx.paymentMethod === "qris"
      ? "QRIS"
      : "-";
  };

  const renderStatusBadge = (status?: string) => {
    const cancelled = status === "CANCELLED";
    return (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          cancelled
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        }`}
      >
        {cancelled ? "CANCELLED" : "SUCCESS"}
      </span>
    );
  };

  // ================================
  // DOWNLOAD CSV
  // ================================
  const downloadCsvByRange = async () => {
    if (!token) return;

    const rows =
      rangeStart || rangeEnd
        ? await fetchTransactionsOnline(token, {
            startDate: rangeStart || undefined,
            endDate: rangeEnd || undefined,
          })
        : filteredTransactions;

    if (rows.length === 0) {
      alert("No transactions in that range.");
      return;
    }

    const header = [
      "id",
      "date",
      "status",
      "payment_method",
      "subtotal",
      "discount",
      "total",
      "items_count",
      "items_detail",
    ];

    const csvRows = rows.map((trx) => {
      const items = trx.items
        .map((i: CartItem) => `${i.name} x${i.quantity} @${i.price}`)
        .join(" | ")
        .replace(/"/g, '""');

      return [
        trx.id,
        trx.date,
        trx.status || "SUCCESS",
        trx.paymentMethod,
        trx.subtotal,
        trx.discount,
        trx.total,
        trx.items.length,
        `"${items}"`,
      ].join(",");
    });

    const csv = [header.join(","), ...csvRows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${rangeStart || "all"}_${rangeEnd || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ================================
  // RENDER PAGE
  // ================================
  return (
    <div className="container mx-auto px-4 py-5 md:py-6">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
        Riwayat Transaksi
      </h1>

      {/* === FILTER PANEL === */}
      <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow-sm mb-4 border dark:border-gray-700">
        {/* Top Row: Search + Date + Download */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Cari ID..."
              className="w-full pl-9 pr-3 py-2.5 border rounded-md bg-gray-50 dark:bg-gray-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="relative w-[140px] md:w-auto">
            <CalendarIcon
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="date"
              className="w-full pl-8 pr-2 py-2.5 border rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          {/* Download Button */}
          <button
            onClick={() => setShowDownload((x) => !x)}
            className="h-[42px] w-[42px] flex items-center justify-center rounded-md border bg-gray-50 dark:bg-gray-900"
            title="Download CSV"
          >
            <Download size={18} />
          </button>
        </div>

        {/* Expandable Download Panel */}
        {showDownload && (
          <div className="mt-3 pt-3 border-t dark:border-gray-700 space-y-2">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Download CSV by Range
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className="px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <input
                type="date"
                className="px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-700 text-sm"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>

            <button
              onClick={downloadCsvByRange}
              className="w-full px-4 py-2 rounded-md bg-blue-600 text-white text-sm active:scale-95"
            >
              Download CSV
            </button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t dark:border-gray-700">
          <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700 min-h-[74px]">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Total Transaksi
            </div>
            <div className="text-lg font-bold mt-1">
              {successCount}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 min-h-[74px]">
            <div className="text-xs text-amber-700 dark:text-amber-300">
              Total Penjualan
            </div>
            <div className="text-lg font-bold mt-1 break-words">
              {formatCurrency(totalSales)}
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800 min-h-[74px]">
            <div className="text-xs text-green-700 dark:text-green-300">
              Total Cash
            </div>
            <div className="text-lg font-bold mt-1 break-words">
              {formatCurrency(totalCash)}
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 min-h-[74px]">
            <div className="text-xs text-blue-700 dark:text-blue-300">
              Total QRIS
            </div>
            <div className="text-lg font-bold mt-1 break-words">
              {formatCurrency(totalQris)}
            </div>
          </div>
        </div>
      </div>

      {/* === TABLE === */}
      {isLoading ? (
        <div className="text-center text-gray-500 py-10">
          Memuat transaksi...
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-3 text-left text-xs text-gray-500">
                    ID
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs text-gray-500 cursor-pointer"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center">
                      Tanggal <ArrowDownUp size={14} className="ml-1" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs text-gray-500 cursor-pointer"
                    onClick={() => handleSort("items")}
                  >
                    <div className="flex items-center">
                      Item <ArrowDownUp size={14} className="ml-1" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 text-left text-xs text-gray-500 cursor-pointer"
                    onClick={() => handleSort("total")}
                  >
                    <div className="flex items-center">
                      Total <ArrowDownUp size={14} className="ml-1" />
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs text-gray-500">
                    Bayar
                  </th>
                  <th className="px-3 py-3 text-left text-xs text-gray-500">
                    Status
                  </th>
                  <th className="px-3 py-3 text-right text-xs text-gray-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((trx) => {
                  const cancelled =
                    trx.status === "CANCELLED" ||
                    trx.paymentMethod === "cancelled";

                  return (
                    <tr
                      key={trx.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-900 ${
                        cancelled
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-3 font-mono text-xs">
                        {trx.id}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {formatDateHistory(trx.date)}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {trx.items.length}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {formatCurrency(trx.total)}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {renderPaymentLabel(trx)}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {renderStatusBadge(trx.status)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          className="text-blue-600 dark:text-blue-400"
                          onClick={() => viewTransaction(trx)}
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center text-gray-500 py-10">
          Tidak ada transaksi.
        </div>
      )}

      {/* MODAL RECEIPT */}
      {selectedTransaction && (
        <Modal
          isOpen={isOpen}
          onClose={closeModal}
          title="Detail Transaksi"
        >
          <Receipt
            {...selectedTransaction}
            transactionId={selectedTransaction.id}
            date={selectedTransaction.date}
            status={selectedTransaction.status}
          />
        </Modal>
      )}
    </div>
  );
};

export default HistoryPage;
