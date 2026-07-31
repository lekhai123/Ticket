import dotenv from "dotenv";
dotenv.config();

// Gom chung 1 chỗ duy nhất để cả Login lẫn AuthMiddleware cùng import
export const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET || "MY_SUPER_SECRET_KEY_123456";
