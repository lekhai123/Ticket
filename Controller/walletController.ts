import type { Request, Response, NextFunction } from "express";
import { WalletService } from "../Service/walletService";

const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class WalletController {
  static topUp = catchAsync(async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    const { amount, batchId, action } = req.body;

    const wallet = await WalletService.topUp(userId, Number(amount), {
      requestId: req.requestId,
      batchId: batchId,
      action: action,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Nạp tiền vào ví thành công!",
      data: wallet,
    });
  });

  static getBalance = catchAsync(async (req: Request, res: Response) => {
    const userIdFromToken = (req as any).user?.id || (req as any).user?.userId;
    const role = (req as any).user?.role;

    // BẢO MẬT: Chỉ Admin mới được xem ví người khác
    let targetUserId = Number(userIdFromToken);
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }

    const wallet = await WalletService.getBalance(targetUserId);

    res.status(200).json({ success: true, data: wallet });
  });

  static getTransactions = catchAsync(async (req: Request, res: Response) => {
    const userIdFromToken = (req as any).user?.id || (req as any).user?.userId;
    const role = (req as any).user?.role;

    let targetUserId = Number(userIdFromToken);
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const result = await WalletService.getWalletTransactions(targetUserId, {
      page,
      limit,
    });

    res.status(200).json({ success: true, data: result });
  });
}
