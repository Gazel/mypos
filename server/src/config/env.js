import dotenv from "dotenv";

dotenv.config();

function numberEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost",
  "http://127.0.0.1",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

export const env = {
  port: numberEnv("PORT", 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins:
    splitCsv(process.env.CORS_ORIGIN || process.env.FRONTEND_URL).length > 0
      ? splitCsv(process.env.CORS_ORIGIN || process.env.FRONTEND_URL)
      : defaultCorsOrigins,
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  dbRetryDelayMs: numberEnv("DB_RETRY_DELAY_MS", 5000),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: numberEnv("DB_PORT", 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "mypos",
    connectionLimit: numberEnv("DB_CONNECTION_LIMIT", 10),
  },
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
    fullName: process.env.ADMIN_FULLNAME || "Super Admin",
  },
};
