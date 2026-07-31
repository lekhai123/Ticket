import { z } from "zod";

export const getStatsSchema = z.object({
  query: z.object({}).passthrough().optional(),
  body: z.object({}).passthrough().optional(),
});

export const getUsersSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),
});

export const massGiftSchema = z.object({
  body: z.object({
    amount: z
      .number({ message: "Vui lòng nhập số tiền hợp lệ" })
      .min(1000, "Số tiền tối thiểu là 1,000 VNĐ"),
    batchId: z.string().min(5, "Batch ID phải dài ít nhất 5 ký tự"),
    reason: z.string().min(10, "Vui lòng nhập lý do rõ ràng để lưu Audit Log"),
    targetType: z.enum(["ALL", "SINGLE"]),
    targetId: z.string().optional(),
    giftType: z.enum(["MONEY", "VOUCHER"]).optional(),
  }),
});

export const getAuditLogsSchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      batchId: z.string().optional(),
      action: z.string().optional(),
      userId: z.string().optional(),
    })
    .optional(),
});

export const getHealthSchema = z.object({
  query: z.object({}).passthrough().optional(),
  body: z.object({}).passthrough().optional(),
});
