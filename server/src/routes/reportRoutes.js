import { Router } from "express";
import {
  getDashboardReport,
  getDashboardSalesTrend,
  getRecipeUsageReport,
} from "../controllers/reportController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const reportRoutes = Router();

reportRoutes.use(authMiddleware, requireDbReady);
reportRoutes.get(
  "/dashboard",
  requireRole("admin"),
  asyncHandler(getDashboardReport)
);
reportRoutes.get(
  "/dashboard/sales-trend",
  requireRole("admin"),
  asyncHandler(getDashboardSalesTrend)
);
reportRoutes.get(
  "/recipe-usage",
  requireRole("admin"),
  asyncHandler(getRecipeUsageReport)
);
