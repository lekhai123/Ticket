import type { Request, Response, NextFunction } from "express";
import { BookingService } from "../Service/bookingService";
import prisma from "../database/prismaClient";

const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export class BookingController {
  // 1. Đặt vé
  static createBooking = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập!" });
    }

    const { tripId, seatNumber, seatNumbers, paymentMethod } = req.body;
    // Xử lý cả trường hợp FE gửi 1 ghế (seatNumber) hoặc mảng nhiều ghế (seatNumbers)
    const seatsToBook = seatNumbers || (seatNumber ? [seatNumber] : []);

    if (!seatsToBook || seatsToBook.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng chọn ghế!" });
    }

    const results = [];
    for (const seat of seatsToBook) {
      const ticket = await BookingService.holdOrBookSeat(
        Number(userId),
        Number(tripId),
        Number(seat),
        paymentMethod || "WALLET",
      );
      results.push(ticket);
    }

    return res.status(201).json({
      success: true,
      message: "Đặt vé thành công!",
      data: results.length === 1 ? results[0] : results,
    });
  });

  // 2. Khách hàng tự hủy vé
  static cancelBooking = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const ticketId = Number(req.params.id);

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập!" });
    }

    const canceledTicket = await BookingService.cancelTicket(userId, ticketId);

    return res.json({
      success: true,
      message: "Hủy vé thành công và đã hoàn tiền vào ví (nếu có)!",
      data: canceledTicket,
    });
  });

  // 3. Lấy danh sách vé (Có phân trang)
  static getUserTickets = catchAsync(async (req: Request, res: Response) => {
    const userIdFromToken = (req as any).user?.id || (req as any).user?.userId;
    const role = (req as any).user?.role;

    let targetUserId = Number(userIdFromToken);
    // Nếu là ADMIN và có truyền userId trên URL thì lấy ID đó
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Mã người dùng không hợp lệ!" });
    }

    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const skip = (page - 1) * limit;

    const [tickets, total] = await prisma.$transaction([
      prisma.tickets.findMany({
        where: { userId: targetUserId },
        include: { trip: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.tickets.count({ where: { userId: targetUserId } }),
    ]);

    return res.status(200).json({
      success: true,
      data: tickets,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // 4. (Dự phòng) Admin thu hồi vé lẻ thông qua BookingController
  static adminRevokeBooking = catchAsync(
    async (req: Request, res: Response) => {
      const ticketId = Number(req.params.id);
      const adminUserId = (req as any).user?.id || (req as any).user?.userId;
      const { reason } = req.body;

      const revokedTicket = await BookingService.adminRevokeTicket(
        ticketId,
        Number(adminUserId),
        reason || "Admin thu hồi vé",
      );

      return res.json({
        success: true,
        message: "Đã thu hồi vé thành công!",
        data: revokedTicket,
      });
    },
  );
}
