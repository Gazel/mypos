import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProductRecipe,
  listProducts,
  replaceProductRecipe,
  updateProduct,
} from "../controllers/productController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireDbReady } from "../middleware/requireDbReady.js";

export const productRoutes = Router();

productRoutes.use(authMiddleware, requireDbReady);
productRoutes.get("/", requireRole("admin", "cashier"), asyncHandler(listProducts));
productRoutes.post("/", requireRole("admin"), asyncHandler(createProduct));
productRoutes.get("/:productId/recipe", requireRole("admin"), asyncHandler(getProductRecipe));
productRoutes.put(
  "/:productId/recipe",
  requireRole("admin"),
  asyncHandler(replaceProductRecipe)
);
productRoutes.put("/:id", requireRole("admin"), asyncHandler(updateProduct));
productRoutes.delete("/:id", requireRole("admin"), asyncHandler(deleteProduct));
