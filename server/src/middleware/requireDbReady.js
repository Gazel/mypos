import { getDbState } from "../db/state.js";
import { startDatabaseBootstrap } from "../db/bootstrap.js";

export function requireDbReady(req, res, next) {
  const dbState = getDbState();
  if (dbState.ready) {
    next();
    return;
  }

  startDatabaseBootstrap();
  res.status(503).json({
    error: "Database is not ready",
    detail: dbState.lastError,
  });
}
