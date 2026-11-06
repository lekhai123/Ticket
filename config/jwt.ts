import dotenv from "dotenv";
dotenv.config();

// Hàm bắt buộc phải có biến môi trường, tránh fallback nguy hiểm
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(
      `[CONFIG ERROR] Biến môi trường "${name}" chưa được khai báo hoặc quá ngắn (yêu cầu >= 32 ký tự)!`,
    );
  }
  return value;
}

// Bắt buộc phải có 2 secret này trong file .env
export const JWT_SECRET = requiredEnv("JWT_ACCESS_SECRET");
export const JWT_REFRESH_SECRET = requiredEnv("JWT_REFRESH_SECRET");
