import { pool } from "../db/pool.js";
import { nextDateParam } from "../utils/date.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateParamToUtcDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateToDateParam(value) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function addDaysParam(value, days) {
  const d = dateParamToUtcDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToDateParam(d);
}

function startOfWeekParam(value) {
  const d = dateParamToUtcDate(value);
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return utcDateToDateParam(d);
}

function startOfMonthParam(value) {
  const d = dateParamToUtcDate(value);
  return utcDateToDateParam(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

function addMonthsParam(value, months) {
  const d = dateParamToUtcDate(value);
  return utcDateToDateParam(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  );
}

function endOfMonthParam(value) {
  const d = dateParamToUtcDate(value);
  return utcDateToDateParam(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  );
}

function daysBetweenInclusive(startDate, endDate) {
  return (
    Math.floor(
      (dateParamToUtcDate(endDate).getTime() -
        dateParamToUtcDate(startDate).getTime()) /
        MS_PER_DAY
    ) + 1
  );
}

function rangeParams(startDate, endDate) {
  return [`${startDate} 00:00:00`, `${nextDateParam(endDate)} 00:00:00`];
}

function successWhere(alias = "t") {
  return `COALESCE(${alias}.status, 'SUCCESS') = 'SUCCESS'
    AND LOWER(${alias}.payment_method) <> 'cancelled'`;
}

function roundNumber(value, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(Number(value || 0) * multiplier) / multiplier;
}

function percentageChange(current, previous) {
  const currentValue = Number(current || 0);
  const previousValue = Number(previous || 0);

  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

function toneFromChange(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function buildTrendPeriods(mode, endDate) {
  if (mode === "weekly") {
    const currentWeekStart = startOfWeekParam(endDate);

    return Array.from({ length: 12 }, (_, index) => {
      const startDate = addDaysParam(currentWeekStart, (index - 11) * 7);
      const rawEndDate = addDaysParam(startDate, 6);

      return {
        key: startDate,
        startDate,
        endDate: rawEndDate > endDate ? endDate : rawEndDate,
        totalSales: 0,
        transactionCount: 0,
      };
    });
  }

  if (mode === "monthly") {
    const currentMonthStart = startOfMonthParam(endDate);

    return Array.from({ length: 6 }, (_, index) => {
      const startDate = addMonthsParam(currentMonthStart, index - 5);
      const rawEndDate = endOfMonthParam(startDate);

      return {
        key: startDate,
        startDate,
        endDate: rawEndDate > endDate ? endDate : rawEndDate,
        totalSales: 0,
        transactionCount: 0,
      };
    });
  }

  return Array.from({ length: 31 }, (_, index) => {
    const date = addDaysParam(endDate, index - 30);

    return {
      key: date,
      startDate: date,
      endDate: date,
      totalSales: 0,
      transactionCount: 0,
    };
  });
}

async function fetchRangeSummary(startDate, endDate) {
  const params = rangeParams(startDate, endDate);

  const [[summaryRows], [itemRows]] = await Promise.all([
    pool.query(
      `
      SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(t.total), 0) AS total_sales,
        COALESCE(AVG(t.total), 0) AS average_bill,
        COALESCE(SUM(CASE WHEN LOWER(t.payment_method) = 'cash' THEN t.total ELSE 0 END), 0) AS total_cash,
        COALESCE(SUM(CASE WHEN LOWER(t.payment_method) = 'qris' THEN t.total ELSE 0 END), 0) AS total_qris
      FROM transactions t
      WHERE ${successWhere("t")}
        AND t.date >= ?
        AND t.date < ?
      `,
      params
    ),
    pool.query(
      `
      SELECT COALESCE(SUM(ti.quantity), 0) AS items_sold
      FROM transactions t
      INNER JOIN transaction_items ti ON ti.transaction_id = t.id
      WHERE ${successWhere("t")}
        AND t.date >= ?
        AND t.date < ?
      `,
      params
    ),
  ]);

  const row = summaryRows[0] || {};
  const itemRow = itemRows[0] || {};

  return {
    transactionCount: Number(row.transaction_count ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    averageBill: Number(row.average_bill ?? 0),
    totalCash: Number(row.total_cash ?? 0),
    totalQris: Number(row.total_qris ?? 0),
    itemsSold: Number(itemRow.items_sold ?? 0),
  };
}

async function fetchPaymentBreakdown(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      LOWER(t.payment_method) AS method,
      COUNT(*) AS transaction_count,
      COALESCE(SUM(t.total), 0) AS total_sales
    FROM transactions t
    WHERE ${successWhere("t")}
      AND t.date >= ?
      AND t.date < ?
    GROUP BY LOWER(t.payment_method)
    ORDER BY total_sales DESC
    `,
    rangeParams(startDate, endDate)
  );

  const byMethod = new Map(
    rows.map((row) => [
      String(row.method || "").toLowerCase(),
      {
        method: String(row.method || "").toLowerCase(),
        transactionCount: Number(row.transaction_count ?? 0),
        totalSales: Number(row.total_sales ?? 0),
      },
    ])
  );

  return ["cash", "qris"].map(
    (method) =>
      byMethod.get(method) || {
        method,
        transactionCount: 0,
        totalSales: 0,
      }
  );
}

async function fetchDailyTrend(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(t.date, '%Y-%m-%d') AS report_date,
      COUNT(*) AS transaction_count,
      COALESCE(SUM(t.total), 0) AS total_sales
    FROM transactions t
    WHERE ${successWhere("t")}
      AND t.date >= ?
      AND t.date < ?
    GROUP BY DATE_FORMAT(t.date, '%Y-%m-%d')
    ORDER BY report_date ASC
    `,
    rangeParams(startDate, endDate)
  );

  const byDate = new Map(
    rows.map((row) => [
      row.report_date,
      {
        date: row.report_date,
        transactionCount: Number(row.transaction_count ?? 0),
        totalSales: Number(row.total_sales ?? 0),
      },
    ])
  );

  const trend = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    trend.push(
      byDate.get(cursor) || {
        date: cursor,
        transactionCount: 0,
        totalSales: 0,
      }
    );
    cursor = addDaysParam(cursor, 1);
  }

  return trend;
}

async function fetchTopProducts(startDate, endDate) {
  const [rows] = await pool.query(
    `
    SELECT
      ti.product_id,
      ti.name AS product_name,
      COALESCE(SUM(ti.quantity), 0) AS quantity_sold,
      COALESCE(SUM(ti.subtotal), 0) AS total_sales
    FROM transactions t
    INNER JOIN transaction_items ti ON ti.transaction_id = t.id
    WHERE ${successWhere("t")}
      AND t.date >= ?
      AND t.date < ?
    GROUP BY ti.product_id, ti.name
    ORDER BY total_sales DESC, quantity_sold DESC
    LIMIT 8
    `,
    rangeParams(startDate, endDate)
  );

  return rows.map((row) => ({
    productId: row.product_id ? String(row.product_id) : "",
    productName: String(row.product_name || "-"),
    quantitySold: Number(row.quantity_sold ?? 0),
    totalSales: Number(row.total_sales ?? 0),
  }));
}

export async function fetchDashboardSalesTrend({ mode = "daily", endDate }) {
  const periods = buildTrendPeriods(mode, endDate);
  const firstPeriod = periods[0];
  const lastPeriod = periods[periods.length - 1];

  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(t.date, '%Y-%m-%d') AS report_date,
      COUNT(*) AS transaction_count,
      COALESCE(SUM(t.total), 0) AS total_sales
    FROM transactions t
    WHERE ${successWhere("t")}
      AND t.date >= ?
      AND t.date < ?
    GROUP BY DATE_FORMAT(t.date, '%Y-%m-%d')
    ORDER BY report_date ASC
    `,
    rangeParams(firstPeriod.startDate, lastPeriod.endDate)
  );

  for (const row of rows) {
    const reportDate = row.report_date;
    const period = periods.find(
      (item) => reportDate >= item.startDate && reportDate <= item.endDate
    );

    if (period) {
      period.totalSales += Number(row.total_sales ?? 0);
      period.transactionCount += Number(row.transaction_count ?? 0);
    }
  }

  return {
    mode,
    filters: {
      startDate: firstPeriod.startDate,
      endDate: lastPeriod.endDate,
    },
    rows: periods,
  };
}

function buildInsights({
  summary,
  comparison,
  previousStartDate,
  previousEndDate,
  topProducts,
  paymentBreakdown,
}) {
  const paymentWinner =
    summary.totalSales > 0
      ? [...paymentBreakdown].sort((a, b) => b.totalSales - a.totalSales)[0]
      : null;
  const topProduct = topProducts[0];

  return [
    {
      key: "salesMomentum",
      label: "Perubahan Penjualan",
      value: roundNumber(comparison.salesChangePct),
      unit: "%",
      tone: toneFromChange(comparison.salesChangePct),
      detail: `Dibanding ${previousStartDate} sampai ${previousEndDate}`,
    },
    {
      key: "transactionMomentum",
      label: "Perubahan Transaksi",
      value: roundNumber(comparison.transactionChangePct),
      unit: "%",
      tone: toneFromChange(comparison.transactionChangePct),
      detail: "Jumlah transaksi sukses dibanding periode sebelumnya",
    },
    {
      key: "bestSeller",
      label: "Produk Teratas",
      value: topProduct ? topProduct.productName : "-",
      unit: "",
      tone: topProduct ? "positive" : "neutral",
      detail: topProduct
        ? `${roundNumber(topProduct.quantitySold, 2)} terjual`
        : "Belum ada transaksi sukses di periode ini",
    },
    {
      key: "paymentMix",
      label: "Metode Dominan",
      value: paymentWinner?.method ? paymentWinner.method.toUpperCase() : "-",
      unit: "",
      tone: "neutral",
      detail: paymentWinner
        ? `${roundNumber(
            (Number(paymentWinner.totalSales || 0) / summary.totalSales) * 100
          )}% dari total penjualan`
        : "Belum ada transaksi sukses di periode ini",
    },
  ];
}

export async function fetchDashboardReport({
  startDate,
  endDate,
  previousStartDate: requestedPreviousStartDate,
  previousEndDate: requestedPreviousEndDate,
}) {
  const spanDays = daysBetweenInclusive(startDate, endDate);
  const previousEndDate =
    requestedPreviousEndDate || addDaysParam(startDate, -1);
  const previousStartDate =
    requestedPreviousStartDate || addDaysParam(startDate, -spanDays);

  const [
    summary,
    previousSummary,
    paymentBreakdown,
    dailyTrend,
    topProducts,
  ] = await Promise.all([
    fetchRangeSummary(startDate, endDate),
    fetchRangeSummary(previousStartDate, previousEndDate),
    fetchPaymentBreakdown(startDate, endDate),
    fetchDailyTrend(startDate, endDate),
    fetchTopProducts(startDate, endDate),
  ]);

  const comparison = {
    totalSales: previousSummary.totalSales,
    transactionCount: previousSummary.transactionCount,
    averageBill: previousSummary.averageBill,
    salesChangePct: percentageChange(
      summary.totalSales,
      previousSummary.totalSales
    ),
    transactionChangePct: percentageChange(
      summary.transactionCount,
      previousSummary.transactionCount
    ),
    averageBillChangePct: percentageChange(
      summary.averageBill,
      previousSummary.averageBill
    ),
  };

  return {
    filters: {
      startDate,
      endDate,
      previousStartDate,
      previousEndDate,
    },
    summary,
    comparison,
    paymentBreakdown,
    dailyTrend,
    topProducts,
    recentTransactions: [],
    insights: buildInsights({
      summary,
      comparison,
      previousStartDate,
      previousEndDate,
      topProducts,
      paymentBreakdown,
    }),
  };
}
