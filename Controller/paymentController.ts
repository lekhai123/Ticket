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
      // BẮT BUỘC phải trả về 200 để PayOS biết đã nhận thành công
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error("Webhook PayOS Error:", err.message);
      // Vẫn trả 200 để PayOS không gọi lại liên tục nếu lỗi logic
      return res.status(200).json({ success: false, message: err.message });
    }
  }
}
