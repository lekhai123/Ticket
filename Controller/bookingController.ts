import type { Request, Response, NextFunction } from "express";
import { BookingService } from "../Service/bookingService";
import prisma from "../database/prismaClient"; // Cần dùng để query danh sách vé

const catchAsync =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export class BookingController {
  static createBooking = catchAsync(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId)
      return res
        .status(401)
        .json({ success: false, message: "Chưa đăng nhập!" });

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

  // Chuyển từ Ticket sang: Lấy danh sách vé của User
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

    // Lấy vé kèm thông tin chuyến xe
    const tickets = await prisma.tickets.findMany({
      where: { userId: targetUserId },
      include: { trip: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: tickets });
  });
}
