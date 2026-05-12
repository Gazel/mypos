import { isDbError } from "../db/pool.js";
import { markDbUnavailable } from "../db/state.js";
import { startDatabaseBootstrap } from "../db/bootstrap.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error("Unhandled error:", err);

  if (isDbError(err)) {
    markDbUnavailable(err);
    startDatabaseBootstrap();
    res.status(503).json({ error: "Database temporarily unavailable" });
    return;
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
  });
}
