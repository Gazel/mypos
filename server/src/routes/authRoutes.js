import { Router } from "express";
import { login, me } from "../controllers/authController.js";
import { authMiddleware } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const authRoutes = Router();

authRoutes.post("/login", requireDbReady, asyncHandler(login));
authRoutes.get("/me", authMiddleware, requireDbReady, asyncHandler(me));
