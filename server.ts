import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

// Imports Middlewares
import { distributedTracing } from "./Middleware/tracingMiddleware"; // 👈 1. Import Tracing Middleware
import { globalErrorHandler } from "./Middleware/errorMiddleware";
import { initReconciliationCron } from "./jobs/reconciliationJob";

// Imports Routes
import otpRoutes from "./Router/otpRoutes";
import tripRoutes from "./Router/tripRoute";
import userRoutes from "./Router/userRoutes";
import walletRoutes from "./Router/walletRoutes";
import ticketRoutes from "./Router/ticketRoutes";
import adminRoutes from "./Router/adminRoutes";
import authRoutes from "./Router/authRoutes";
import bookingRoutes from "./Router/bookingRoutes";

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173", // Cho phép đúng origin của Vite Frontend
    credentials: true, // Cho phép gửi cookie / Authorization Header
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "idempotency-key",
      "x-request-id",
      "X-Request-ID",
    ],
  }),
);
const PORT = process.env.PORT || 3000;

// 1. Middleware đọc JSON body từ request
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173", // 👈 URL Frontend React/Vite của bạn
    credentials: true, // 👈 Cho phép gửi/nhận cookie cross-origin
  }),
);

// 🌟 2. GẮN DISTRIBUTED TRACING Ở ĐÂY
// Phải nằm BÊN TRÊN tất cả các Routes để mọi Request đi qua đều được cấp X-Request-ID
app.use(distributedTracing);

// 3. Đăng ký các Routes
app.use("/api/otp", otpRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("api/bookings", bookingRoutes);
// 4. Global Error Handler (Bắt buộc đặt DƯỚI CÙNG)
app.use(globalErrorHandler);
initReconciliationCron();
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
