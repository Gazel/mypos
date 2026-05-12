import { pool } from "../db/pool.js";
import { isDateParam, nextDateParam } from "../utils/date.js";

function mapTransactionRows(rows) {
  const trxMap = new Map();

  for (const row of rows) {
    const trxId = String(row.transaction_id);

    if (!trxMap.has(trxId)) {
      trxMap.set(trxId, {
        id: trxId,
        subtotal: Number(row.subtotal),
        discount: Number(row.discount),
        total: Number(row.total),
        date: row.date,
        paymentMethod: row.payment_method,
        cashReceived: row.cash_received ?? 0,
        change: row.change_amount ?? 0,
        customerName: row.customer_name ?? undefined,
        note: row.note ?? undefined,
        status: row.status || "SUCCESS",
        items: [],
      });
    }

    if (row.item_id) {
      trxMap.get(trxId).items.push({
        productId: row.product_id ? String(row.product_id) : "",
        name: row.item_name,
        price: Number(row.item_price),
        quantity: Number(row.item_quantity),
        subtotal: Number(row.item_subtotal),
      });
    }
  }

  return [...trxMap.values()];
}

export function buildTransactionFilters(req) {
  const { date, startDate, endDate } = req.query || {};
  const where = [];
  const params = [];

  if (req.user.role === "cashier") {
    where.push("t.status = 'SUCCESS'");
  }

  if (date && (startDate || endDate)) {
    const err = new Error("Use either date or startDate/endDate, not both.");
    err.statusCode = 400;
    throw err;
  }

  if (date) {
    if (!isDateParam(date)) {
      const err = new Error("Invalid date format. Use YYYY-MM-DD.");
      err.statusCode = 400;
      throw err;
    }

    where.push("t.date >= ? AND t.date < ?");
    params.push(`${date} 00:00:00`, `${nextDateParam(date)} 00:00:00`);
  } else {
    if (startDate) {
      if (!isDateParam(startDate)) {
        const err = new Error("Invalid startDate format. Use YYYY-MM-DD.");
        err.statusCode = 400;
        throw err;
      }

      where.push("t.date >= ?");
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      if (!isDateParam(endDate)) {
        const err = new Error("Invalid endDate format. Use YYYY-MM-DD.");
        err.statusCode = 400;
        throw err;
      }

      where.push("t.date < ?");
      params.push(`${nextDateParam(endDate)} 00:00:00`);
    }
  }

  return { where, params };
}

export async function fetchTransactions(filters) {
  const whereSql = filters.where.length
    ? `WHERE ${filters.where.join(" AND ")}`
    : "";

  const [rows] = await pool.query(
    `
    SELECT
      t.id AS transaction_id,
      t.subtotal,
      t.discount,
      t.total,
      t.date,
      t.payment_method,
      t.cash_received,
      t.change_amount,
      t.customer_name,
      t.note,
      t.status,
      ti.id AS item_id,
      ti.product_id,
      ti.name AS item_name,
      ti.price AS item_price,
      ti.quantity AS item_quantity,
      ti.subtotal AS item_subtotal
    FROM transactions t
    LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
    ${whereSql}
    ORDER BY t.date DESC, ti.id ASC
    `,
    filters.params
  );

  return mapTransactionRows(rows);
}

export async function fetchDailySalesSummary({ startDate, endDate }) {
  const [rows] = await pool.query(
    `
    SELECT
      DATE_FORMAT(t.date, '%Y-%m-%d') AS summary_date,
      COUNT(*) AS transaction_count,
      COALESCE(SUM(t.total), 0) AS total_sales,
      COALESCE(SUM(CASE WHEN t.payment_method = 'cash' THEN t.total ELSE 0 END), 0) AS total_cash,
      COALESCE(SUM(CASE WHEN t.payment_method = 'qris' THEN t.total ELSE 0 END), 0) AS total_qris
    FROM transactions t
    WHERE t.status = 'SUCCESS'
      AND t.payment_method <> 'cancelled'
      AND t.date >= ?
      AND t.date < ?
    GROUP BY DATE_FORMAT(t.date, '%Y-%m-%d')
    ORDER BY summary_date DESC
    `,
    [`${startDate} 00:00:00`, `${nextDateParam(endDate)} 00:00:00`]
  );

  return rows.map((row) => ({
    date: row.summary_date,
    transactionCount: Number(row.transaction_count ?? 0),
    totalSales: Number(row.total_sales ?? 0),
    totalCash: Number(row.total_cash ?? 0),
    totalQris: Number(row.total_qris ?? 0),
  }));
}
