import { Router } from "express";
import { clearCategory } from "../controllers/categoryController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const categoryRoutes = Router();

categoryRoutes.use(authMiddleware, requireDbReady, requireRole("admin"));
categoryRoutes.delete("/:name", asyncHandler(clearCategory));
