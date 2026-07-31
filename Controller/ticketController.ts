import type { Request, Response } from "express";
import { TicketService } from "../Service/ticketService";

export class TicketController {
  // 1. Đặt vé chuyến xe (Transaction trừ tiền ví + tạo vé + Redis Lock)
  static async bookTicket(req: Request, res: Response): Promise<Response> {
    try {
      // 🎯 LẤY USER ID TỪ REQ.USER (JWT Auth Middleware)
      const userId = (req as any).user?.id || (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Không tìm thấy thông tin người dùng trong Token!",
        });
      }

      const { tripId, seatNumbers, seatIds, seatNumber } = req.body;

      // Lấy mảng ghế từ 1 trong 3 key gửi lên
      const seatsToBook =
        seatNumbers || seatIds || (seatNumber ? [seatNumber] : []);

      const result = await TicketService.bookTicketTransaction(
        Number(userId),
        Number(tripId),
        seatsToBook,
      );

      return res.status(201).json({
        success: true,
        message: "Đặt vé thành công!",
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Lỗi server khi đặt vé",
      });
    }
  }

  // 2. Xem lịch sử vé của User (Ưu tiên lấy từ JWT Token để bảo mật)
  static async getUserTickets(req: Request, res: Response): Promise<Response> {
    try {
      const userIdFromToken =
        (req as any).user?.id || (req as any).user?.userId;
      const userId = Number(req.params.userId) || Number(userIdFromToken);

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "Mã người dùng không hợp lệ!",
        });
      }

      const tickets = await TicketService.getTicketsByUserId(userId);
      return res.status(200).json({
        success: true,
        data: tickets,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Lỗi khi lấy danh sách vé",
      });
    }
  }

  // 3. Khách hàng hủy vé (Bảo mật: Lấy userId từ Token)
  static async cancelTicket(req: Request, res: Response): Promise<Response> {
    try {
      const ticketId = Number(req.params.ticketId);
      // 🎯 Lấy userId từ Token thay vì req.body để tránh kẻ xấu hủy nhầm vé người khác
      const userId =
        (req as any).user?.id || (req as any).user?.userId || req.body.userId;

      if (!ticketId || !userId) {
        return res.status(400).json({
          success: false,
          message: "Thông tin vé hoặc người dùng không hợp lệ!",
        });
      }

      const result = await TicketService.cancelTicket(ticketId, Number(userId));

      return res.status(200).json({
        success: true,
        message: `Hủy vé thành công! Đã hoàn ${result.refundAmount ?? 0} VNĐ vào ví của bạn.`,
        data: result,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Lỗi hệ thống khi hủy vé",
      });
    }
  }
}
