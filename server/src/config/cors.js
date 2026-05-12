import { env } from "./env.js";

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    const err = new Error("Origin not allowed by CORS");
    err.statusCode = 403;
    callback(err);
  },
};
