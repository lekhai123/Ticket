// FILE: api/index.ts
import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

// Middlewares
import { distributedTracing } from "../Middleware/tracingMiddleware";
import { globalErrorHandler } from "../Middleware/errorMiddleware";
import { initReconciliationCron } from "../jobs/reconciliationJob";

// Routes
import otpRoutes from "../Router/otpRoutes";
import tripRoutes from "../Router/tripRoute";
import userRoutes from "../Router/userRoutes";
import walletRoutes from "../Router/walletRoutes";
import ticketRoutes from "../Router/ticketRoutes";
import adminRoutes from "../Router/adminRoutes";
import authRoutes from "../Router/authRoutes";
import bookingRoutes from "../Router/bookingRoutes";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép localhost, postman, và toàn bộ domain vercel
      if (
        !origin ||
        origin.includes("localhost") ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "idempotency-key",
      "x-idempotency-key",
      "x-request-id",
      "X-Request-ID",
    ],
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(distributedTracing);

// API Endpoints
app.use("/api/otp", otpRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);

// Error Handler
app.use(globalErrorHandler);

// Chỉ listen port khi chạy local độc lập
if (!process.env.VERCEL) {
  initReconciliationCron();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

export default app;
