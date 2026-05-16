// src/pages/HistoryPage.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  CalendarIcon,
  Eye,
  ArrowDownUp,
  RefreshCw,
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency, formatDateHistory } from "../utils/formatter";
import Modal from "../components/UI/Modal";
import { useModal } from "../components/UI/useModal";
import Receipt from "../components/POS/Receipt";
import type { Transaction } from "../types";
import { subscribeTransactionsOnline } from "../services/apiBackend";

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

  const refreshTransactions = async () => {
    if (!token || !dateFilter || isLoading) return;

    setIsLoading(true);
    try {
      await reloadTransactions({ date: dateFilter });
    } finally {
      setIsLoading(false);
    }
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
  // RENDER PAGE
  // ================================
  return (
    <div className="container mx-auto px-4 py-5 md:py-6">
      <h1 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
        Riwayat Transaksi
      </h1>

      {/* === FILTER PANEL === */}
      <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-lg shadow-sm mb-4 border dark:border-gray-700">
        {/* Top Row: Search + Date + Refresh */}
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
          <div className="flex h-[42px] w-[150px] items-center gap-2 rounded-md border bg-gray-50 px-3 dark:bg-gray-700 md:w-auto">
            <CalendarIcon
              size={16}
              className="shrink-0 text-gray-400"
            />
            <input
              type="date"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <button
            onClick={refreshTransactions}
            disabled={isLoading || !dateFilter}
            className="h-[42px] w-[42px] flex shrink-0 items-center justify-center rounded-md border bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
            title="Refresh transaksi"
            aria-label="Refresh transaksi"
          >
            <RefreshCw size={17} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>

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
          <div className="fit-table-wrap">
            <table className="fit-table divide-y dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="w-[18%] text-left">
                    ID
                  </th>
                  <th
                    className="w-[23%] cursor-pointer text-left"
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center">
                      Tanggal <ArrowDownUp size={14} className="ml-1" />
                    </div>
                  </th>
                  <th
                    className="w-[10%] cursor-pointer text-left"
                    onClick={() => handleSort("items")}
                  >
                    <div className="flex items-center">
                      Item <ArrowDownUp size={14} className="ml-1" />
                    </div>
                  </th>
                  <th
                    className="w-[17%] cursor-pointer text-left"
                    onClick={() => handleSort("total")}
                  >
                    <div className="flex items-center">
                      Total <ArrowDownUp size={14} className="ml-1" />
                    </div>
                  </th>
                  <th className="w-[11%] text-left">
                    Bayar
                  </th>
                  <th className="w-[14%] text-left">
                    Status
                  </th>
                  <th className="w-[7%] text-right">
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
                      <td className="font-mono">
                        {trx.id}
                      </td>
                      <td>
                        {formatDateHistory(trx.date)}
                      </td>
                      <td>
                        {trx.items.length}
                      </td>
                      <td>
                        {formatCurrency(trx.total)}
                      </td>
                      <td>
                        {renderPaymentLabel(trx)}
                      </td>
                      <td>
                        {renderStatusBadge(trx.status)}
                      </td>
                      <td className="fit-table-actions">
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
