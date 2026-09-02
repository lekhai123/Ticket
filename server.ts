import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

// Imports Middlewares
import { distributedTracing } from "./Middleware/tracingMiddleware";
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

// Danh sách origin được phép truy cập (Localhost + Domain Frontend Vercel của bạn)
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL || "", // Ví dụ: https://your-frontend.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request không có origin hoặc nằm trong danh sách
      if (
        !origin ||
        (origin && origin.endsWith(".vercel.app")) || // 👈 Thêm dòng này để cho phép Vercel
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

// Distributed Tracing
app.use(distributedTracing);

// 3. Đăng ký các Routes (Đã sửa lại /api/bookings có dấu /)
app.use("/api/otp", otpRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes); // 👈 Đã sửa lỗi thiếu dấu /

// 4. Global Error Handler
app.use(globalErrorHandler);

// Chỉ chạy Cron job ở môi trường server truyền thống / local (trên Vercel Serverless cron job sẽ không duy trì được vòng lặp vô hạn)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  initReconciliationCron();
}

// Chỉ listen port khi chạy local độc lập
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}

// 🌟 BẮT BUỘC ĐỂ VERCEL XỬ LÝ REQUEST
export default app;
