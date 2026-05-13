import { Router } from "express";
import {
  createIngredientPrice,
  listIngredientPrices,
  updateIngredientPrice,
} from "../controllers/ingredientPriceController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const ingredientPriceRoutes = Router();

ingredientPriceRoutes.use(authMiddleware, requireDbReady, requireRole("admin"));
ingredientPriceRoutes.get("/", asyncHandler(listIngredientPrices));
ingredientPriceRoutes.post("/", asyncHandler(createIngredientPrice));
ingredientPriceRoutes.put("/:id", asyncHandler(updateIngredientPrice));
