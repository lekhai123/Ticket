import dotenv from "dotenv";
dotenv.config();

// Hàm bắt buộc phải có biến môi trường
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[CONFIG ERROR] Thiếu biến môi trường "${name}" cho Cloudinary!`,
    );
  }
  return value;
}

// 1. Cấu hình Primary (Bắt buộc phải có)
export const cloudinaryPrimaryConfig = {
  cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"),
  api_key: requiredEnv("CLOUDINARY_API_KEY"),
  api_secret: requiredEnv("CLOUDINARY_API_SECRET"),
  secure: true,
};

// 2. Cấu hình Backup (Nếu có thì dùng, không có thì fallback về Primary)
export const cloudinaryBackupConfig =
  process.env.CLOUDINARY_CLOUD_NAME_BACKUP &&
  process.env.CLOUDINARY_API_KEY_BACKUP &&
  process.env.CLOUDINARY_API_SECRET_BACKUP
    ? {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME_BACKUP,
        api_key: process.env.CLOUDINARY_API_KEY_BACKUP,
        api_secret: process.env.CLOUDINARY_API_SECRET_BACKUP,
        secure: true,
      }
    : cloudinaryPrimaryConfig;

console.log(
  "[CLOUDINARY] Đã nạp cấu hình Primary:",
  cloudinaryPrimaryConfig.cloud_name,
);
if (cloudinaryBackupConfig !== cloudinaryPrimaryConfig) {
  console.log(
    "[CLOUDINARY] Đã nạp cấu hình Backup:",
    cloudinaryBackupConfig.cloud_name,
  );
} else {
  console.warn(
    "[CLOUDINARY] Cảnh báo: Không có cấu hình Backup, dùng chung bucket Primary.",
  );
}
