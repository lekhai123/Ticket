import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL chưa được khai báo trong file .env!");
}

const AUDIT_SECRET =
  process.env.AUDIT_SECRET_KEY || "NexusTicket_Audit_Secret_2026";

// Hàm băm dữ liệu JSON ổn định (Sắp xếp key để chuỗi JSON luôn giống nhau)
function generateSignature(data: any): string {
  const signData = {
    requestId: data.requestId,
    userId: data.userId,
    action: data.action,
    resource: data.resource,
    resourceId: data.resourceId,
    newData: data.newData,
    oldData: data.oldData,
  };

  // Sắp xếp key theo thứ tự bảng chữ cái để đảm bảo tính nhất quán
  const sortedData = JSON.stringify(signData, Object.keys(signData).sort());
  return crypto
    .createHmac("sha256", AUDIT_SECRET)
    .update(sortedData)
    .digest("hex");
}

const basePrisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
} as any);

export const prisma = basePrisma.$extends({
  query: {
    auditLog: {
      // 1. TỰ ĐỘNG KÝ TÊN KHI TẠO MỚI 1 LOG
      async create({ args, query }) {
        if (args.data) {
          const data = Array.isArray(args.data) ? args.data[0] : args.data;
          if (data) {
            data.signature = generateSignature(data);
          }
        }
        return query(args);
      },

      // 2. TỰ ĐỘNG KÝ TÊN KHI TẠO NHIỀU LOG CÙNG LÚC (MASS GIFT)
      async createMany({ args, query }) {
        if (args.data) {
          const dataArray = Array.isArray(args.data) ? args.data : [args.data];
          dataArray.forEach((data) => {
            data.signature = generateSignature(data);
          });
        }
        return query(args);
      },

      // 3. CHẶN UPDATE (Chỉ cho phép sửa isRevoked)
      async update({ args, query }) {
        const dataKeys = Object.keys(args.data || {});
        const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");

        if (illegalKeys.length > 0) {
          throw new Error(
            `⛔ SECURITY ERROR: Bảng AuditLog là Append-Only! Chỉ được phép cập nhật trường 'isRevoked'. Các trường vi phạm: [${illegalKeys.join(", ")}]`,
          );
        }
        return query(args);
      },

      // 4. CHẶN UPDATE HÀNG LOẠT
      async updateMany({ args, query }) {
        const dataKeys = Object.keys(args.data || {});
        const illegalKeys = dataKeys.filter((key) => key !== "isRevoked");

        if (illegalKeys.length > 0) {
          throw new Error(
            `⛔ SECURITY ERROR: Không được phép sửa hàng loạt dữ liệu AuditLog! Chỉ cho phép sửa 'isRevoked'. Các trường vi phạm: [${illegalKeys.join(", ")}]`,
          );
        }
        return query(args);
      },

      // 5. CHẶN DELETE
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
