import prisma from "../database/prismaClient";

export class WalletService {
  /**
   * 1. Lấy thông tin số dư ví của User
   */
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

  /**
   * 2. Nạp / Tặng tiền vào ví bằng Atomic Operation + Ghi AuditLog lưu vết
   */
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
      // 1. Kiểm tra ví tồn tại
      const wallet = await tx.wallets.findUnique({
        where: { userId },
      });

      if (!wallet) {
        const error: any = new Error("Không tìm thấy ví của người dùng này!");
        error.statusCode = 404;
        throw error;
      }

      // 2. Nạp tiền Atomic
      const updatedWallet = await tx.wallets.update({
        where: { userId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      // 3. Ghi AuditLog lưu vết biến động
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

  /**
   * 3. Lấy lịch sử giao dịch ví từ AuditLog (Hỗ trợ phân trang & tham số mặc định)
   */
  static async getWalletTransactions(
    userId: number,
    params: { page?: number; limit?: number } = {},
  ) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    // 1. Lấy thông tin ví (Nếu chưa có ví thì trả về mặc định balance = 0, KHÔNG throw error)
    const wallet = await prisma.wallets.findUnique({
      where: { userId },
    });

    const walletIdStr = wallet ? String(wallet.id) : null;
    const currentBalance = wallet ? wallet.balance : 0;

    // Nếu user chưa có ví thì chắc chắn chưa có giao dịch nào
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

    // 2. Điều kiện Query linh hoạt: Lấy cả log do User tự thực hiện HOẶC log do Admin tác động lên Wallet này
    const whereCondition = {
      OR: [
        // TH1: Log do chính User này thực hiện
        {
          userId: userId,
          action: {
            in: [
              "TOP_UP",
              "BOOK_TICKET_PAYMENT",
              "CANCEL_TICKET_REFUND",
              "SYSTEM_GIFT_BALANCE",
            ],
          },
        },
        // TH2: Log do Admin tác động lên ví của User này (Resource = Wallets, resourceId = wallet.id)
        {
          resource: "Wallets",
          resourceId: walletIdStr,
          action: {
            in: [
              "MASS_GIFT_WALLET",
              "REVOKE_MASS_GIFT",
              "REVOKE_BATCH",
              "ADMIN_ADJUST_BALANCE",
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
