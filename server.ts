import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

import { distributedTracing } from "./Middleware/tracingMiddleware";
import { globalErrorHandler } from "./Middleware/errorMiddleware";
import { initReconciliationCron } from "./jobs/reconciliationJob";

import otpRoutes from "./Router/otpRoutes";
import tripRoutes from "./Router/tripRoute";
import userRoutes from "./Router/userRoutes";
import walletRoutes from "./Router/walletRoutes";
import ticketRoutes from "./Router/ticketRoutes";
import adminRoutes from "./Router/adminRoutes";
import authRoutes from "./Router/authRoutes";
import bookingRoutes from "./Router/bookingRoutes";

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL || "",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        (origin && origin.endsWith(".vercel.app")) ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "idempotency-key",
      "x-request-id",
      "X-Request-ID",
      "x-idempotency-key",
    ],
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use(distributedTracing);

app.use("/api/otp", otpRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);

app.use(globalErrorHandler);

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  initReconciliationCron();
}

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

export default app;
