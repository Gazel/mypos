import { pool } from "../db/pool.js";
import { generateDailyId } from "../utils/dailyId.js";
import {
  buildTransactionFilters,
  fetchDailySalesSummary,
  fetchTransactions,
} from "../services/transactionService.js";
import { isDateParam } from "../utils/date.js";
import {
  addTransactionStreamClient,
  broadcastTransactionCreated,
} from "../services/transactionStream.js";

export async function listTransactions(req, res) {
  const filters = buildTransactionFilters(req);
  const result = await fetchTransactions(filters);
  res.json(result);
}

export async function listTransactionSummary(req, res) {
  const { startDate, endDate } = req.query || {};

  if (!isDateParam(startDate) || !isDateParam(endDate)) {
    const err = new Error("Invalid date range. Use startDate and endDate as YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }

  if (startDate > endDate) {
    const err = new Error("startDate must be before or equal to endDate.");
    err.statusCode = 400;
    throw err;
  }

  const result = await fetchDailySalesSummary({ startDate, endDate });
  res.json(result);
}

export function streamTransactions(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  addTransactionStreamClient(req, res);
}

export async function createTransaction(req, res) {
  const idempotencyKey =
    typeof req.headers["idempotency-key"] === "string"
      ? req.headers["idempotency-key"].trim().slice(0, 120)
      : "";

  if (idempotencyKey) {
    const [[existingRequest]] = await pool.query(
      `
      SELECT transaction_id
        FROM transaction_idempotency_keys
       WHERE idempotency_key = ?
       LIMIT 1
      `,
      [idempotencyKey]
    );

    if (existingRequest?.transaction_id) {
      const [existingTransaction] = await fetchTransactions({
        where: ["t.id = ?"],
        params: [existingRequest.transaction_id],
      });

      if (existingTransaction) return res.json(existingTransaction);
    }
  }

  const {
    items,
    subtotal,
    discount,
    total,
    paymentMethod,
    cashReceived,
    change,
    customerName,
    note,
    status,
  } = req.body || {};

  const serverDate = new Date();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    if (idempotencyKey) {
      try {
        await conn.query(
          `
          INSERT INTO transaction_idempotency_keys (idempotency_key)
          VALUES (?)
          `,
          [idempotencyKey]
        );
      } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
          await conn.rollback();
          return res.status(409).json({
            error: "Transaction request is already being processed",
          });
        }

        throw err;
      }
    }

    const newId = await generateDailyId(conn, serverDate.toISOString());

    await conn.query(
      `
      INSERT INTO transactions
        (id, subtotal, discount, total, date, payment_method,
         cash_received, change_amount, customer_name, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        newId,
        subtotal,
        discount ?? 0,
        total,
        serverDate,
        paymentMethod,
        cashReceived ?? 0,
        change ?? 0,
        customerName || null,
        note || null,
        status || "SUCCESS",
      ]
    );

    for (const item of items || []) {
      const productId = item.productId ? Number(item.productId) : null;
      await conn.query(
        `
        INSERT INTO transaction_items
          (transaction_id, product_id, name, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [newId, productId, item.name, item.price, item.quantity, item.subtotal]
      );
    }

    if (idempotencyKey) {
      await conn.query(
        `
        UPDATE transaction_idempotency_keys
           SET transaction_id = ?
         WHERE idempotency_key = ?
        `,
        [newId, idempotencyKey]
      );
    }

    await conn.commit();

    const [savedTransaction] = await fetchTransactions({
      where: ["t.id = ?"],
      params: [newId],
    });

    if (!savedTransaction) {
      throw new Error("Saved transaction could not be loaded");
    }

    broadcastTransactionCreated(savedTransaction);
    res.json(savedTransaction);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
