import { app } from "./src/app.js";
import { env } from "./src/config/env.js";
import { startDatabaseBootstrap } from "./src/db/bootstrap.js";
import { pool } from "./src/db/pool.js";

const server = app.listen(env.port, () => {
  console.log(`mypos API running on port ${env.port}`);
});

startDatabaseBootstrap();

const shutdown = async () => {
  console.log("Shutting down mypos API...");
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
