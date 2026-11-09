import type { Request, Response, NextFunction } from "express";
import { BookingService } from "../Service/bookingService";
import prisma from "../database/prismaClient";

const catchAsync =
  (fn: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class BookingController {
  static createBooking = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập!" });

    // Nhận cả mảng seatNumbers hoặc 1 seatNumber
    const { tripId, seatNumber, seatNumbers, paymentMethod } = req.body;
    const seatsToBook = seatNumbers || (seatNumber ? [seatNumber] : []);

    if (!seatsToBook || seatsToBook.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng chọn ghế!" });
    }

    const results = [];
    // Lặp qua từng ghế để đặt
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

  static cancelBooking = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const ticketId = Number(req.params.id);
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập!" });

    const canceledTicket = await BookingService.cancelTicket(userId, ticketId);
    return res.json({
      success: true,
      message: "Hủy vé thành công và đã hoàn tiền vào ví (nếu có)!",
      data: canceledTicket,
    });
  });

  static adminRevokeBooking = catchAsync(
    async (req: Request, res: Response) => {
      const ticketId = Number(req.params.id);
      const revokedTicket = await BookingService.adminRevokeTicket(ticketId);
      return res.json({
        success: true,
        message: "Đã thu hồi vé thành công!",
        data: revokedTicket,
      });
    },
  );

  static getUserTickets = catchAsync(async (req: Request, res: Response) => {
    const userIdFromToken = (req as any).user?.id || (req as any).user?.userId;
    const role = (req as any).user?.role;

    let targetUserId = Number(userIdFromToken);
    if (role === "ADMIN" && req.params.userId) {
      targetUserId = Number(req.params.userId);
    }

    if (!targetUserId) {
      return res
        .status(400)
        .json({ success: false, message: "Mã người dùng không hợp lệ!" });
    }

    const tickets = await prisma.tickets.findMany({
      where: { userId: targetUserId },
      include: { trip: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: tickets });
  });
}
