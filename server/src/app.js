import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { userRoutes } from "./routes/userRoutes.js";
import { productRoutes } from "./routes/productRoutes.js";
import { categoryRoutes } from "./routes/categoryRoutes.js";
import { ingredientRoutes } from "./routes/ingredientRoutes.js";
import { ingredientPriceRoutes } from "./routes/ingredientPriceRoutes.js";
import { reportRoutes } from "./routes/reportRoutes.js";
import { transactionRoutes } from "./routes/transactionRoutes.js";

export const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/ingredient-prices", ingredientPriceRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/reports", reportRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
