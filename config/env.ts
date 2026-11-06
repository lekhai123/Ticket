import dotenv from "dotenv";
dotenv.config();

// Vercel tự động bơm biến process.env.VERCEL = '1' khi chạy trên cloud
export const isVercel = Boolean(process.env.VERCEL);
export const isProduction = process.env.NODE_ENV === "production" || isVercel;

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL!,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://localhost:8000",
  FRONTEND_URL: isProduction
    ? process.env.FRONTEND_URL || "https://your-production-domain.com"
    : "http://localhost:5173",
};
