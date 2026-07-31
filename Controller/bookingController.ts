// FILE: Controllers/bookingController.ts
import type { Request, Response } from "express";
import { BookingService } from "../Service/bookingService";

export class BookingController {
  /**
   * POST /api/bookings - Giữ chỗ & Đặt vé
   */
  static async createBooking(req: Request, res: Response) {
    try {
      // 🎯 Lấy userId an toàn từ Token (Do authenticateToken gắn vào)
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!userId) {
        return res
          .status(401)
          .json({
            success: false,
            message: "Xác thực không hợp lệ. Vui lòng đăng nhập lại!",
          });
      }

      const { tripId, seatNumber, paymentMethod } = req.body;

      const ticket = await BookingService.holdOrBookSeat(
        Number(userId),
        Number(tripId),
        Number(seatNumber),
        paymentMethod || "WALLET",
      );

      return res.status(201).json({
        success: true,
        message: "Đặt vé thành công!",
        data: ticket,
      });
    } catch (err: any) {
      return res
        .status(err.statusCode || 500)
        .json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/bookings/:id/cancel - Khách hủy vé
   */
  static async cancelBooking(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const ticketId = Number(req.params.id);

      const canceledTicket = await BookingService.cancelTicket(
        userId,
        ticketId,
      );

      return res.json({
        success: true,
        message: "Hủy vé thành công và đã hoàn tiền vào ví (nếu có)!",
        data: canceledTicket,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }

  /**
   * PATCH /api/admin/bookings/:id/revoke - Admin thu hồi vé
   */
  static async adminRevokeBooking(req: Request, res: Response) {
    try {
      const ticketId = Number(req.params.id);
      const revokedTicket = await BookingService.adminRevokeTicket(ticketId);

      return res.json({
        success: true,
        message: "Đã thu hồi vé thành công!",
        data: revokedTicket,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 500).json({ message: err.message });
    }
  }
}
