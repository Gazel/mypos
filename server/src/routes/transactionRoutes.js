import { Router } from "express";
import {
  createTransaction,
  listTransactionSummary,
  listTransactions,
  streamTransactions,
} from "../controllers/transactionController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const transactionRoutes = Router();

transactionRoutes.use(authMiddleware);
transactionRoutes.get("/summary", requireRole("admin"), requireDbReady, asyncHandler(listTransactionSummary));
transactionRoutes.get("/", requireRole("admin", "cashier"), requireDbReady, asyncHandler(listTransactions));
transactionRoutes.get("/stream", requireRole("admin", "cashier"), streamTransactions);
transactionRoutes.post("/", requireRole("admin", "cashier"), requireDbReady, asyncHandler(createTransaction));
