import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { ENV, isVercel } from "./config/env";

import { distributedTracing } from "./Middleware/tracingMiddleware";
import { globalErrorHandler } from "./Middleware/errorMiddleware";
import { checkMaintenance } from "./Middleware/maintenanceMiddleware";

import otpRoutes from "./Router/otpRoutes";
import tripRoutes from "./Router/tripRoute";
import userRoutes from "./Router/userRoutes";
import walletRoutes from "./Router/walletRoutes";
import adminRoutes from "./Router/adminRoutes";
import authRoutes from "./Router/authRoutes";
import bookingRoutes from "./Router/bookingRoutes";
import paymentRoutes from "./Router/paymentRoutes";

const app = express();

// Thêm trust proxy để chống Hacker fake IP qua X-Forwarded-For
app.set("trust proxy", 1);

app.use(helmet());
app.disable("x-powered-by");

const allowedOrigins = ["http://localhost:5173", ENV.FRONTEND_URL].filter(
  Boolean,
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Chỉ cho phép đúng domain trong mảng, bỏ qua các domain *.vercel.app khác
      if (!origin || allowedOrigins.includes(origin)) {
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

app.use(checkMaintenance);

app.use("/api/otp", otpRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

app.use(globalErrorHandler);

export default app;
