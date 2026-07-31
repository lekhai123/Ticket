import { z } from "zod";

/**
 * Schema validate cho API Nạp tiền vào ví: POST /api/wallets/:userId/topup
 */
export const topUpWalletSchema = z.object({
  params: z.object({
    userId: z.coerce
      .number({ message: "User ID phải là số!" })
      .positive("User ID phải là số nguyên dương lớn hơn 0!"),
  }),
  body: z.object({
    amount: z
      .number({ message: "Số tiền nạp không được bỏ trống và phải là số!" })
      .positive("Số tiền nạp vào ví phải lớn hơn 0!"),

    // 🌟 BỔ SUNG 2 TRƯỜNG NÀY ĐỂ ZOD KHÔNG CẮT BỎ DỮ LIỆU LOG
    batchId: z.string().optional().nullable(),
    action: z.string().optional().nullable(),
  }),
});

/**
 * Schema validate cho API Xem số dư ví: GET /api/wallets/:userId
 */
export const getUserWalletSchema = z.object({
  params: z.object({
    userId: z.coerce
      .number({ message: "User ID phải là số!" })
      .positive("User ID phải là số nguyên dương lớn hơn 0!"),
  }),
});
export const getWalletTransactionsSchema = z.object({
  params: z.object({
    userId: z.string().transform((val) => Number(val)),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});
