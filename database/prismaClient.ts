import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import { AuditSigner } from "../Utils/auditSigner";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL chưa được khai báo trong file .env!");
}

const basePrisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
} as any);

export const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      async create({ args, query }) {
        if (args.data) {
          const data = Array.isArray(args.data) ? args.data[0] : args.data;
          if (data) {
            // Dùng AuditSigner.generateSignature thay vì hàm tự viết
            data.signature = AuditSigner.generateSignature(data);
          }
        }
        return query(args);
      },
      async createMany({ args, query }) {
        if (args.data) {
          const dataArray = Array.isArray(args.data) ? args.data : [args.data];
          dataArray.forEach((data) => {
            // Dùng AuditSigner.generateSignature
            data.signature = AuditSigner.generateSignature(data);
          });
        }
        return query(args);
      },
      //update và delete chặn Append-Only
      async update({ args, query }) {
        const dataKeys = Object.keys(args.data || {});
        const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");
        if (illegalKeys.length > 0)
          throw new Error(`⛔ SECURITY ERROR: Chỉ được sửa 'isRevoked'!`);
        return query(args);
      },
      async updateMany({ args, query }) {
        const dataKeys = Object.keys(args.data || {});
        const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");
        if (illegalKeys.length > 0)
          throw new Error(`⛔ SECURITY ERROR: Không được sửa hàng loạt!`);
        return query(args);
      },
      async delete() {
        throw new Error("⛔ SECURITY ERROR: Cấm xóa AuditLog!");
      },
      async deleteMany() {
        throw new Error("⛔ SECURITY ERROR: Cấm xóa AuditLog!");
      },
    },
  },
});

export default prisma;
