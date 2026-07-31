import type { Request, Response, NextFunction } from "express";
import { WalletService } from "../Service/walletService";

export class WalletController {
  // Nạp tiền / Tặng tiền vào ví
  static async topUp(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = Number(req.params.userId);
      const { amount, batchId, action } = req.body;

      // Truyền dữ liệu bổ sung xuống Service để ghi vết AuditLog
      const wallet = await WalletService.topUp(userId, Number(amount), {
        requestId: req.requestId, // Tracing ID sinh từ distributedTracing middleware
        batchId: batchId, // VD: "ERR_PROMO_2026"
        action: action, // VD: "SYSTEM_GIFT_BALANCE" hoặc "TOP_UP"
        ipAddress: req.ip,
      });

      res.status(200).json({
        success: true,
        message: "Nạp tiền vào ví thành công!",
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
    console.log("👉 [CONTROLLER REQ.BODY]:", req.body);
  }

  // Xem số dư ví
  static async getBalance(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = Number(req.params.userId);
      const wallet = await WalletService.getBalance(userId);

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }
  static async getTransactions(req: Request, res: Response): Promise<void> {
    const userId = Number(req.params.userId);
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;

    const result = await WalletService.getWalletTransactions(userId, {
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  }
}
