import { pool } from "../db/pool.js";
import { getDbState, markDbReady, markDbUnavailable } from "../db/state.js";
import { startDatabaseBootstrap } from "../db/bootstrap.js";

export function live(req, res) {
  res.json({ status: "ok" });
}

export async function ready(req, res) {
  try {
    await pool.query("SELECT 1");
    markDbReady();
  } catch (err) {
    markDbUnavailable(err);
    startDatabaseBootstrap();
  }

  const db = getDbState();
  res.status(db.ready ? 200 : 503).json({
    status: db.ready ? "ready" : "not_ready",
    database: db,
  });
}
