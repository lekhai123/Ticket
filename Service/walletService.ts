import prisma from "../database/prismaClient";

export class WalletService {
  static async getBalance(userId: number) {
    const wallet = await prisma.wallets.findUnique({
      where: { userId },
    });

    if (!wallet) {
      const error: any = new Error("Không tìm thấy ví của người dùng này!");
      error.statusCode = 404;
      throw error;
    }

    return wallet;
  }

  static async topUp(
    userId: number,
    amount: number,
    options?: {
      requestId?: string | undefined;
      batchId?: string | undefined;
      action?: string | undefined;
      ipAddress?: string | undefined;
    },
  ) {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallets.findUnique({
        where: { userId },
      });

      if (!wallet) {
        const error: any = new Error("Không tìm thấy ví của người dùng này!");
        error.statusCode = 404;
        throw error;
      }

      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          requestId: options?.requestId || `TOPUP_${Date.now()}`,
          userId: userId,
          action: options?.action || "TOP_UP",
          batchId: options?.batchId || null,
          resource: "Wallets",
          resourceId: String(updatedWallet.id),
          oldData: { balance: wallet.balance },
          newData: {
            amount: amount,
            giftAmount: amount,
            description: `Nạp tiền vào ví: +${amount.toLocaleString("vi-VN")} VNĐ`,
            newBalance: updatedWallet.balance,
          },
          ipAddress: options?.ipAddress || null,
        },
      });

      return updatedWallet;
    });
  }

  static async getWalletTransactions(
    userId: number,
    params: { page?: number; limit?: number } = {},
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const wallet = await prisma.wallets.findUnique({
      where: { userId },
    });

    const walletIdStr = wallet ? String(wallet.id) : null;
    const currentBalance = wallet ? Number(wallet.balance) : 0;

    if (!walletIdStr) {
      return {
        currentBalance: 0,
        transactions: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
    }

    const whereCondition = {
      OR: [
        {
          userId: userId,
          action: {
            in: [
              "TOP_UP",
              "BOOK_TICKET_PAYMENT",
              "CANCEL_TICKET_REFUND",
              "SYSTEM_GIFT_BALANCE",
              "MASS_GIFT_RECEIVED",
              "MASS_GIFT_REVOKED",
              "REFUND_TICKET_PAYMENT",
            ],
          },
        },
        {
          resource: "Wallets",
          resourceId: walletIdStr,
          action: {
            in: [
              "MASS_GIFT_WALLET",
              "MASS_GIFT_RECEIVED",
              "MASS_GIFT_REVOKED",
              "REVOKE_MASS_GIFT",
              "REVOKE_BATCH",
              "ADMIN_ADJUST_BALANCE",
              "REFUND_TICKET_PAYMENT",
            ],
          },
        },
      ],
    };

    const [transactions, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({
        where: whereCondition,
      }),
    ]);

    return {
      currentBalance,
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
