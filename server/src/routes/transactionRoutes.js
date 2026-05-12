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

transactionRoutes.use(authMiddleware, requireRole("admin", "cashier"));
transactionRoutes.get("/summary", requireDbReady, asyncHandler(listTransactionSummary));
transactionRoutes.get("/", requireDbReady, asyncHandler(listTransactions));
transactionRoutes.get("/stream", streamTransactions);
transactionRoutes.post("/", requireDbReady, asyncHandler(createTransaction));
