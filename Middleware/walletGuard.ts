// src/middlewares/walletGuard.ts
import type { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const checkWalletLock = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Unauthenticated" });

    const wallet = await prisma.wallets.findUnique({ where: { userId } });
    if (!wallet)
      return res
        .status(404)
        .json({ success: false, message: "Ví không tồn tại" });

    const balanceNum = Number(wallet.balance);

    // Bỏ qua nếu route là Nạp tiền (Cho phép nạp tiền để xóa nợ/mở khóa)
    const isTopUpRoute = req.originalUrl.includes("/wallet/topup");

    if ((wallet.isLocked || balanceNum < 0) && !isTopUpRoute) {
      return res.status(403).json({
        success: false,
        code: "WALLET_LOCKED_OR_DEBT",
        message:
          balanceNum < 0
            ? `⛔ Ví của bạn đang âm (${balanceNum.toLocaleString("vi-VN")} VNĐ). Vui lòng nạp tiền thanh toán khoản nợ để tiếp tục sử dụng web!`
            : "⛔ Ví của bạn đang bị TẠM KHÓA do hệ thống phát hiện biến động bất thường. Vui lòng liên hệ Admin!",
        data: {
          currentBalance: balanceNum,
          isLocked: wallet.isLocked,
          allowedAction: "TOP_UP_ONLY",
        },
      });
    }

    next();
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Lỗi kiểm tra trạng thái ví" });
  }
};
