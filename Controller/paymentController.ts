// Controller/paymentController.ts
import type { Request, Response } from "express";
import { PaymentService } from "../Service/paymentService";

export class PaymentController {
  // FE gọi API này để lấy link thanh toán
  static async createTopUp(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { amount } = req.body;

      const checkoutUrl = await PaymentService.createTopUpLink(
        Number(userId),
        Number(amount),
      );

      return res.status(200).json({
        success: true,
        message: "Tạo link thanh toán thành công!",
        checkoutUrl,
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // PayOS gọi API này (Server-to-Server)
  static async webhook(req: Request, res: Response) {
  try {
    await PaymentService.handleWebhook(req.body);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Webhook PayOS Error:", err.message);

    // 1. Lỗi chữ ký hoặc dữ liệu sai logic: Trả 200 để Cổng thanh toán KHÔNG retry nữa
    const isClientOrLogicError = 
      err.message.includes("Chữ ký không hợp lệ") ||
      err.message.includes("không hợp lệ") ||
      err.statusCode === 400;

    if (isClientOrLogicError) {
      return res.status(200).json({ success: false, message: err.message });
    }

    // 2. Lỗi Database, Network, Redis chập chờn: Trả 500 để PayOS RETRY lại sau ít phút
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi hạ tầng tạm thời, yêu cầu retry!" 
    });
  }
}
}
