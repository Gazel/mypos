import { Router } from "express";
import {
  createIngredient,
  deleteIngredient,
  listIngredients,
  updateIngredient,
} from "../controllers/ingredientController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const ingredientRoutes = Router();

ingredientRoutes.use(authMiddleware, requireDbReady, requireRole("admin"));
ingredientRoutes.get("/", asyncHandler(listIngredients));
ingredientRoutes.post("/", asyncHandler(createIngredient));
ingredientRoutes.put("/:id", asyncHandler(updateIngredient));
ingredientRoutes.delete("/:id", asyncHandler(deleteIngredient));
