import { Router } from "express";
import { live, ready } from "../controllers/healthController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const healthRoutes = Router();

healthRoutes.get("/live", live);
healthRoutes.get("/ready", asyncHandler(ready));
