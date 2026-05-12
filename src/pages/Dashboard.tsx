import React, { useEffect, useState } from "react";
import {
  BarChart,
  PieChart,
  ArrowUp,
  Wallet,
  ShoppingBag,
  Calendar,
} from "lucide-react";
import { useProducts } from "../contexts/ProductContext";
import { useCart } from "../contexts/CartContext";
import { formatCurrency } from "../utils/formatter";
import type { CartItem, Transaction } from "../types";

// ---------- helpers ----------
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYesterday() {
  const d = startOfToday();
  d.setDate(d.getDate() - 1);
  return d;
}

function endOfYesterday() {
  const d = startOfToday();
  d.setMilliseconds(-1); // 1ms before today starts
  return d;
}

function startOfWeek() {
  const now = new Date();
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

type RangeKey = "all" | "today" | "yesterday" | "week" | "month" | "custom";

function filterTransactions(
  transactions: Transaction[],
  range: RangeKey,
  customStart?: string,
  customEnd?: string
) {
  if (range === "all") return transactions;

  let start: Date | null = null;
  let end: Date | null = null;

  if (range === "today") {
    start = startOfToday();
  } else if (range === "yesterday") {
    start = startOfYesterday();
    end = endOfYesterday();
  } else if (range === "week") {
    start = startOfWeek();
  } else if (range === "month") {
    start = startOfMonth();
  } else if (range === "custom") {
    if (customStart) {
      start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
    }
    if (customEnd) {
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    }
  }

  return transactions.filter((t) => {
    const txDate = new Date(t.date);
    if (start && txDate < start) return false;
    if (end && txDate > end) return false;
    return true;
  });
}

// ---------- component ----------
const Dashboard: React.FC = () => {
  const { products } = useProducts();
  const { transactions } = useCart();

  // Range state
  const [range, setRange] = useState<RangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Stats
  const [totalSales, setTotalSales] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);

  // Charts + recent
  const [salesByProductAmount, setSalesByProductAmount] = useState<{
    [key: string]: number;
  }>({});
  const [salesByProductQty, setSalesByProductQty] = useState<{
    [key: string]: number;
  }>({});
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>(
    []
  );

  useEffect(() => {
    // ✅ only SUCCESS should affect dashboard
    const successTxAll = (transactions || []).filter(
      (t) => (t.status || "SUCCESS") === "SUCCESS"
    );

    // ----- filtered by range (SUCCESS only) -----
    const filteredTx = filterTransactions(
      successTxAll,
      range,
      customStart,
      customEnd
    );

    // Totals (range-based, SUCCESS only)
    const total = filteredTx.reduce((acc, t) => acc + (t.total || 0), 0);
    setTotalSales(total);
    setTotalTransactions(filteredTx.length);

    // Today stats (SUCCESS only, not range-based)
    const todayStart = startOfToday();
    const todayTx = successTxAll.filter((t) => new Date(t.date) >= todayStart);
    const todayTotal = todayTx.reduce((acc, t) => acc + (t.total || 0), 0);
    setTodaySales(todayTotal);
    setTodayTransactions(todayTx.length);

    // Sales by product (Amount + Quantity) - range-based, SUCCESS only
    const amountMap: { [key: string]: number } = {};
    const qtyMap: { [key: string]: number } = {};

    filteredTx.forEach((tx) => {
      (tx.items || []).forEach((item: CartItem) => {
        const name = item.name;
        const qty = item.quantity || 0;
        const amount = item.subtotal || item.price * qty || 0;

        if (!amountMap[name]) amountMap[name] = 0;
        if (!qtyMap[name]) qtyMap[name] = 0;

        amountMap[name] += amount;
        qtyMap[name] += qty;
      });
    });

    setSalesByProductAmount(amountMap);
    setSalesByProductQty(qtyMap);

    // Recent transactions (range-based, SUCCESS only)
    const recent = [...filteredTx]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
    setRecentTransactions(recent);
  }, [products, transactions, range, customStart, customEnd]);

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header + Range Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <select
            className="
              px-3 py-2 rounded-md border border-gray-300 
              dark:border-gray-700 bg-white dark:bg-gray-800 text-sm
            "
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
          >
            <option value="all">Total (All Time)</option>
            <option value="today">Hari Ini</option>
            <option value="yesterday">Kemarin</option>
            <option value="week">Minggu Ini</option>
            <option value="month">Bulan Ini</option>
            <option value="custom">Custom Date</option>
          </select>
        </div>
      </div>

      {/* Custom range inputs */}
      {range === "custom" && (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                End Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Kosongkan start/end untuk “open range”.
          </p>
        </div>
      )}

      {/* Stats Cards (NEW ORDER) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                {/* 1. Penjualan Hari Ini (SUCCESS only) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Penjualan Hari Ini
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(todaySales)}
              </p>
              {todaySales > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <ArrowUp size={12} className="mr-1" />
                  {((todaySales / (totalSales || 1)) * 100).toFixed(1)}% dari total
                </p>
              )}
            </div>
            <div className="h-12 w-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-green-600 dark:text-green-300">
              <Wallet size={24} />
            </div>
          </div>
        </div>

        {/* 2. Transaksi Hari Ini (SUCCESS only) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Transaksi Hari Ini
              </p>
              <p className="text-2xl font-bold">{todayTransactions}</p>
              {todayTransactions > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center mt-1">
                  <ArrowUp size={12} className="mr-1" />
                  {((todayTransactions / (totalTransactions || 1)) * 100).toFixed(1)}% dari total
                </p>
              )}
            </div>
            <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-300">
              <PieChart size={24} />
            </div>
          </div>
        </div>
      
        {/* 3. Total Penjualan (range-based) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Penjualan
              </p>
              <p className="text-2xl font-bold">
                {formatCurrency(totalSales)}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-300">
              <BarChart size={24} />
            </div>
          </div>
        </div>

        {/* 4. Total Transaksi (range-based) */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Transaksi
              </p>
              <p className="text-2xl font-bold">{totalTransactions}</p>
            </div>
            <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <ShoppingBag size={24} />
            </div>
          </div>
        </div>
        </div>


      {/* Charts + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Sales by Product (Amount) */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">
            Penjualan Berdasarkan Produk (Rp)
          </h2>

          {Object.keys(salesByProductAmount).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(salesByProductAmount)
                .sort((a, b) => b[1] - a[1])
                .map(([name, amount]) => (
                  <div key={name} className="flex items-center">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mr-2">
                      <div
                        className="bg-blue-600 h-4 rounded-full"
                        style={{
                          width: `${
                            totalSales > 0 ? (amount / totalSales) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-sm whitespace-nowrap">
                      {name} ({formatCurrency(amount)})
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Tidak ada penjualan di range ini
            </p>
          )}
        </div>

        {/* Chart 2: Sales by Product (Quantity) */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">
            Produk Terjual Berdasarkan Kuantitas
          </h2>

          {Object.keys(salesByProductQty).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(salesByProductQty)
                .sort((a, b) => b[1] - a[1])
                .map(([name, qty]) => {
                  const maxQty =
                    Math.max(...Object.values(salesByProductQty)) || 1;

                  return (
                    <div key={name} className="flex items-center">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mr-2">
                        <div
                          className="bg-green-600 h-4 rounded-full"
                          style={{ width: `${(qty / maxQty) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm whitespace-nowrap">
                        {name} ({qty} pcs)
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Tidak ada penjualan di range ini
            </p>
          )}
        </div>

        {/* Recent Transactions (SUCCESS only) */}
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Transaksi Terbaru</h2>

          {recentTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="py-2 px-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="py-2 px-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b dark:border-gray-700"
                    >
                      <td className="py-2 px-2 text-sm">{transaction.id}</td>
                      <td className="py-2 px-2 text-sm">
                        {new Date(transaction.date).toLocaleDateString("id-ID")}
                      </td>
                      <td className="py-2 px-2 text-sm">
                        {transaction.items.length} item
                      </td>
                      <td className="py-2 px-2 text-sm text-right">
                        {formatCurrency(transaction.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center">
              Belum ada transaksi di range ini
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
