// FILE: config/cloudinary.ts
import { v2 as cloudinaryPrimary } from "cloudinary";
import { v2 as cloudinaryBackup } from "cloudinary";
import dotenv from "dotenv";

dotenv.config(); // 🎯 Nạp biến môi trường từ .env

// 1. Config Cloudinary Primary
cloudinaryPrimary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
  secure: true,
});

// 2. Config Cloudinary Backup (Đọc biến có dấu - trong .env)
cloudinaryBackup.config({
  cloud_name: process.env["CLOUDINARY_CLOUD_NAME-BACKUP"] || "",
  api_key: process.env["CLOUDINARY_API_KEY-BACKUP"] || "",
  api_secret: process.env["CLOUDINARY_API_SECRET-BACKUP"] || "",
  secure: true,
});

export { cloudinaryPrimary, cloudinaryBackup };
export default cloudinaryPrimary;
