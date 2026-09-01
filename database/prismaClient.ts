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

// 2. Khởi tạo Instance Prisma Client gốc
const basePrisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
} as any);

// 3. Bổ sung Security Layer cho AuditLog (Chỉ cho phép sửa 'isRevoked', cấm DELETE)
export const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      // Kiểm soát lệnh UPDATE đơn lẻ
      async update({ args, query }) {
        const dataKeys = Object.keys(args.data || {});
        const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");

        if (illegalKeys.length > 0) {
          throw new Error(
            `⛔ SECURITY ERROR: Bảng AuditLog là Append-Only! Chỉ được phép cập nhật trường 'isRevoked'. Các trường vi phạm: [${illegalKeys.join(
              ", ",
            )}]`,
          );
        }

        return query(args);
      },

      // Kiểm soát lệnh UPDATE hàng loạt (Batch Revoke)
      async updateMany({ args, query }) {
        const dataKeys = Object.keys(args.data || {});
        const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");

        if (illegalKeys.length > 0) {
          throw new Error(
            `⛔ SECURITY ERROR: Không được phép sửa hàng loạt dữ liệu AuditLog! Chỉ cho phép sửa 'isRevoked'. Các trường vi phạm: [${illegalKeys.join(
              ", ",
            )}]`,
          );
        }

        return query(args);
      },

      // Chặn tuyệt đối mọi thao tác DELETE
      async delete() {
        throw new Error(
          "⛔ SECURITY ERROR: Bảng AuditLog là Append-Only! Nghiêm cấm mọi hành vi DELETE.",
        );
      },
      async deleteMany() {
        throw new Error(
          "⛔ SECURITY ERROR: Nghiêm cấm mọi hành vi DELETE hàng loạt AuditLog.",
        );
      },
    },
  },
});

export default prisma;
