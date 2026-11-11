import dotenv from "dotenv";
dotenv.config();

// Vercel tự động bơm biến process.env.VERCEL = '1' khi chạy trên cloud
export const isVercel = Boolean(process.env.VERCEL);
export const isProduction = process.env.NODE_ENV === "production" || isVercel;

// Hàm làm sạch URL: xóa khoảng trắng thừa và dấu / ở cuối (nếu có)
const cleanUrl = (url?: string) =>
  url ? url.trim().replace(/\/$/, "") : undefined;

if (isProduction && !process.env.FRONTEND_URL) {
  console.warn(
    "[CẢNH BÁO] Biến FRONTEND_URL chưa được cấu hình trên Production! Hãy kiểm tra lại Vercel Env.",
  );
}

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000",

  // Đã sửa: Làm sạch URL và đổi fallback thành domain thật
  FRONTEND_URL: isProduction
    ? cleanUrl(process.env.FRONTEND_URL) || "https://ticket-lekhai.vercel.app"
    : "http://localhost:5173",
};
