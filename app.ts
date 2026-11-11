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
const rawOrigins = [
  "http://localhost:5173",
  "https://ticket-lekhai.vercel.app", // Hardcode dự phòng
  ENV.FRONTEND_URL,
];

// Làm sạch URL: Xóa khoảng trắng thừa, xóa dấu / ở cuối
const allowedOrigins = rawOrigins
  .filter(Boolean)
  .map((url) => url!.trim().replace(/\/$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Cho phép request không có origin (Postman, Webhook, Server-to-Server)
      if (!origin) return callback(null, true);

      // 2. Làm sạch origin từ client
      const cleanOrigin = origin.trim().replace(/\/$/, "");

      // 3. In log để debug trên Vercel
      console.log(
        `[CORS CHECK] Client: "${cleanOrigin}" | Allowed: ${allowedOrigins.join(", ")}`,
      );

      // 4. Cho phép nếu khớp mảng HOẶC là link preview của Vercel (*.vercel.app)
      if (
        allowedOrigins.includes(cleanOrigin) ||
        /^https:\/\/.*\.vercel\.app$/.test(cleanOrigin)
      ) {
        return callback(null, true);
      }

      console.error(`[CORS BLOCKED] Từ chối Origin: "${cleanOrigin}"`);
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

// Fix lỗi Preflight (OPTIONS) của Express 5
app.options(/.*/, cors());

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
