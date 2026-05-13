import {
  fetchDashboardReport,
  fetchDashboardSalesTrend,
} from "../services/dashboardReportService.js";
import { fetchRecipeUsageReport } from "../services/recipeUsageReportService.js";
import { isDateParam } from "../utils/date.js";

const trendModes = new Set(["daily", "weekly", "monthly"]);

function validateDateRange(startDate, endDate) {
  if (!isDateParam(startDate) || !isDateParam(endDate)) {
    const err = new Error("Invalid date range. Use startDate and endDate as YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }

  if (startDate > endDate) {
    const err = new Error("startDate must be before or equal to endDate.");
    err.statusCode = 400;
    throw err;
  }
}

export async function getRecipeUsageReport(req, res) {
  const { startDate, endDate } = req.query || {};

  validateDateRange(startDate, endDate);

  const result = await fetchRecipeUsageReport({ startDate, endDate });
  res.json(result);
}

export async function getDashboardReport(req, res) {
  const { startDate, endDate, previousStartDate, previousEndDate } =
    req.query || {};

  validateDateRange(startDate, endDate);

  if (previousStartDate || previousEndDate) {
    validateDateRange(previousStartDate, previousEndDate);
  }

  const result = await fetchDashboardReport({
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
  });
  res.json(result);
}

export async function getDashboardSalesTrend(req, res) {
  const { mode = "daily", endDate } = req.query || {};

  if (!trendModes.has(mode)) {
    const err = new Error("Invalid trend mode. Use daily, weekly, or monthly.");
    err.statusCode = 400;
    throw err;
  }

  if (!isDateParam(endDate)) {
    const err = new Error("Invalid endDate. Use endDate as YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }

  const result = await fetchDashboardSalesTrend({ mode, endDate });
  res.json(result);
}
