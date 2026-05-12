import { Router } from "express";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from "../controllers/userController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const userRoutes = Router();

userRoutes.use(authMiddleware, requireDbReady, requireRole("admin"));
userRoutes.get("/", asyncHandler(listUsers));
userRoutes.post("/", asyncHandler(createUser));
userRoutes.put("/:id", asyncHandler(updateUser));
userRoutes.delete("/:id", asyncHandler(deleteUser));
