import { env } from "../config/env.js";
import { initDatabase } from "./schema.js";
import { getDbState, markDbReady, markDbUnavailable } from "./state.js";

let isBootstrapping = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startDatabaseBootstrap() {
  if (isBootstrapping || getDbState().ready) return;

  isBootstrapping = true;
  void bootstrapLoop();
}

async function bootstrapLoop() {
  while (!getDbState().ready) {
    try {
      await initDatabase();
      markDbReady();
    } catch (err) {
      markDbUnavailable(err);
      console.error(
        `Database unavailable: ${err.message}. Retrying in ${env.dbRetryDelayMs}ms.`
      );
      await sleep(env.dbRetryDelayMs);
    }
  }

  isBootstrapping = false;
}
