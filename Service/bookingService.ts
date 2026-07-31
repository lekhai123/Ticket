// FILE: Services/bookingService.ts
import prisma from "../database/prismaClient";
import { RedisLock } from "../Utils/redisLock";

export class BookingService {
  /**
   * 🎯 1. GIỮ GHẾ VÀ TẠO VÉ (Sử dụng Redis Distributed Lock)
   */
  static async holdOrBookSeat(
    userId: number,
    tripId: number,
    seatNumber: number,
    paymentMethod: "WALLET" | "LATER" = "WALLET",
  ) {
    const lockKey = `lock:trip:${tripId}:seat:${seatNumber}`;

    // 🔒 1. Bắt Redis Lock (Khóa trong 10 giây để xử lý DB transaction)
    const lockToken = await RedisLock.acquire(lockKey, 10);
    if (!lockToken) {
      const error: any = new Error(
        `Ghế số ${seatNumber} đang có người khác thao tác chọn. Vui lòng chọn ghế khác!`,
      );
      error.statusCode = 409; // Conflict
      throw error;
    }

    try {
      // 2. Kiểm tra DB xem ghế đã thực sự bị giữ/đặt chưa
      const existingTicket = await prisma.tickets.findFirst({
        where: {
          tripId,
          seatNumber,
          status: { in: ["HELD", "PENDING", "CONFIRMED"] },
        },
      });

      if (existingTicket) {
        const error: any = new Error(
          `Ghế số ${seatNumber} đã có người đặt hoặc đang giữ chỗ!`,
        );
        error.statusCode = 400;
        throw error;
      }

      // Lấy thông tin chuyến xe để check giá tiền
      const trip = await prisma.trips.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        const error: any = new Error("Chuyến xe không tồn tại!");
        error.statusCode = 404;
        throw error;
      }

      // 3. Thực hiện Transaction: Trừ tiền Ví (nếu thanh toán ngay) + Tạo vé + Giảm số ghế trống
      const result = await prisma.$transaction(async (tx) => {
        let initialStatus: "HELD" | "PENDING" | "CONFIRMED" = "PENDING";

        if (paymentMethod === "WALLET") {
          // Kiểm tra số dư ví của User
          const wallet = await tx.wallets.findUnique({
            where: { userId },
          });

          const currentBalance = Number(wallet?.balance || 0);
          const tripPrice = Number(trip.price);

          if (currentBalance < tripPrice) {
            const error: any = new Error(
              "Số dư ví không đủ để thanh toán vé này!",
            );
            error.statusCode = 400;
            throw error;
          }

          // Trừ tiền ví
          await tx.wallets.update({
            where: { userId },
            data: {
              balance: { decrement: tripPrice },
            },
          });

          initialStatus = "CONFIRMED"; // Thanh toán bằng ví xong -> Xác nhận luôn
        }

        // Tạo vé với trạng thái tương ứng
        const newTicket = await tx.tickets.create({
          data: {
            userId,
            tripId,
            seatNumber,
            status: initialStatus,
          },
        });

        // Giảm số ghế trống của chuyến xe
        await tx.trips.update({
          where: { id: tripId },
          data: {
            availableSeats: { decrement: 1 },
          },
        });

        return newTicket;
      });

      return result;
    } finally {
      // 🔓 4. Luôn giải phóng Redis Lock sau khi hoàn tất
      await RedisLock.release(lockKey, lockToken);
    }
  }

  /**
   * 🎯 2. KHÁCH HÀNG CHỦ ĐỘNG HỦY VÉ
   */
  static async cancelTicket(userId: number, ticketId: number) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true },
    });

    if (!ticket) {
      const error: any = new Error("Không tìm thấy vé đặt!");
      error.statusCode = 404;
      throw error;
    }

    if (ticket.userId !== userId) {
      const error: any = new Error("Bạn không có quyền hủy vé này!");
      error.statusCode = 403;
      throw error;
    }

    if (ticket.status === "CANCELED" || ticket.status === "USED") {
      const error: any = new Error("Vé này không thể hủy được nữa!");
      error.statusCode = 400;
      throw error;
    }

    // Thực hiện transaction hủy vé, hoàn tiền vào ví (nếu đã CONFIRMED) và tăng lại số ghế trống
    return await prisma.$transaction(async (tx) => {
      // Cập nhật trạng thái vé thành CANCELED
      const updatedTicket = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "CANCELED" },
      });

      // Tăng lại số ghế trống cho chuyến xe
      await tx.trips.update({
        where: { id: ticket.tripId },
        data: { availableSeats: { increment: 1 } },
      });

      // Nếu vé đã được thanh toán (CONFIRMED), tiến hành hoàn tiền vào ví
      if (ticket.status === "CONFIRMED") {
        await tx.wallets.update({
          where: { userId },
          data: { balance: { increment: ticket.trip.price } },
        });
      }

      return updatedTicket;
    });
  }

  /**
   * 🎯 3. ADMIN THU HỒI VÉ / HỦY VÉ
   */
  static async adminRevokeTicket(ticketId: number) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      const error: any = new Error("Không tìm thấy vé!");
      error.statusCode = 404;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "REVOKED_BY_ADMIN" },
      });

      // Trả lại ghế trống cho chuyến xe
      await tx.trips.update({
        where: { id: ticket.tripId },
        data: { availableSeats: { increment: 1 } },
      });

      return updated;
    });
  }
}
