// FILE: database/prismaClient.ts
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

// 1. Nạp file .env ngay lập tức trước khi PrismaClient được khởi tạo
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL chưa được khai báo trong file .env!");
}

// 2. Kiểm tra nếu Prisma 7 bắt buộc dùng override URL hoặc Client Options
export const prisma = new PrismaClient({
  // Đối với Prisma 7.x, nếu không dùng config file tự động, ta chỉ định trực tiếp datasource
  datasources: {
    db: {
      url: dbUrl,
    },
  },
} as any);

export default prisma;
