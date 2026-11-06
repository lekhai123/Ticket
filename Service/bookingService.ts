import prisma from "../database/prismaClient";
import { RedisLock } from "../Utils/redisLock";
import { MultiLevelCache } from "./cacheService";

export class BookingService {
  /**
   * 1. GIỮ GHẾ VÀ TẠO VÉ
   * Khóa 2 tầng: Redis (nhanh) + Postgres advisory lock (an toàn tuyệt đối).
   * Advisory lock tự nhả khi transaction commit/rollback.
   */
  static async holdOrBookSeat(
    userId: number,
    tripId: number,
    seatNumber: number,
    paymentMethod: "WALLET" | "LATER" = "WALLET",
  ) {
    const lockKey = `lock:trip:${tripId}:seat:${seatNumber}`;

    // TTL 30s đủ cho transaction đặt vé (timeout 25s bên dưới)
    const lockToken = await RedisLock.acquire(lockKey, 30);
    if (!lockToken) {
      const error: any = new Error(
        `Ghế số ${seatNumber} đang có người khác thao tác chọn. Vui lòng chọn ghế khác!`,
      );
      error.statusCode = 409;
      throw error;
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Advisory lock theo ghế — bảo vệ khi Redis lock hết hạn/Redis down.
          // Tự động nhả khi transaction commit hoặc rollback.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`seat:${tripId}:${seatNumber}`}))`;

          // Check ghế — chạy trong transaction (an toàn với race condition)
          const existingTicket = await tx.tickets.findFirst({
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

          // Lấy trip trong transaction để giá không đổi giữa chừng
          const trip = await tx.trips.findUnique({ where: { id: tripId } });
          if (!trip) {
            const error: any = new Error("Chuyến xe không tồn tại!");
            error.statusCode = 404;
            throw error;
          }

          let initialStatus: "HELD" | "PENDING" | "CONFIRMED" = "PENDING";

          if (paymentMethod === "WALLET") {
            const wallet = await tx.wallets.findUnique({ where: { userId } });
            const currentBalance = Number(wallet?.balance || 0);
            const tripPrice = Number(trip.price);

            if (currentBalance < tripPrice) {
              const error: any = new Error(
                "Số dư ví không đủ để thanh toán vé này!",
              );
              error.statusCode = 400;
              throw error;
            }

            await tx.wallets.update({
              where: { userId },
              data: { balance: { decrement: tripPrice } },
            });

            initialStatus = "CONFIRMED";
          }

          return tx.tickets.create({
            data: { userId, tripId, seatNumber, status: initialStatus },
          });
        },
        { timeout: 25000 },
      );

      // Xóa cache sơ đồ ghế + danh sách trip để availableSeats cập nhật
      try {
        await MultiLevelCache.invalidate(`trips:detail:${tripId}`);
        await MultiLevelCache.invalidate("trips:all:active");
      } catch (cacheErr: any) {
        console.warn("[BOOKING] Xóa cache thất bại:", cacheErr.message);
      }

      return result;
    } finally {
      await RedisLock.release(lockKey, lockToken);
    }
  }

  /**
   * 2. KHÁCH HÀNG CHỦ ĐỘNG HỦY VÉ (có hoàn tiền nếu đã thanh toán)
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

    // Chặn hủy vé đã hủy / đã dùng / đã bị admin thu hồi
    if (
      ticket.status === "CANCELED" ||
      ticket.status === "USED" ||
      ticket.status === "REVOKED_BY_ADMIN"
    ) {
      const error: any = new Error("Vé này không thể hủy được nữa!");
      error.statusCode = 400;
      throw error;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "CANCELED" },
      });

      // Hoàn tiền nếu vé đã thanh toán bằng ví
      if (ticket.status === "CONFIRMED") {
        await tx.wallets.update({
          where: { userId },
          data: { balance: { increment: ticket.trip.price } },
        });
      }

      return updatedTicket;
    });

    try {
      await MultiLevelCache.invalidate(`trips:detail:${ticket.tripId}`);
      await MultiLevelCache.invalidate("trips:all:active");
      await MultiLevelCache.invalidate(`user:${userId}:tickets*`);
    } catch (cacheErr: any) {
      console.warn("[BOOKING] Xóa cache thất bại:", cacheErr.message);
    }

    return result;
  }

  /**
   * 3. ADMIN THU HỒI VÉ (có hoàn tiền nếu đã thanh toán)
   * Đồng bộ với revocationService.revokeBatch — admin thu hồi cũng hoàn tiền.
   */
  static async adminRevokeTicket(ticketId: number) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true },
    });

    if (!ticket) {
      const error: any = new Error("Không tìm thấy vé!");
      error.statusCode = 404;
      throw error;
    }

    if (ticket.status === "REVOKED_BY_ADMIN" || ticket.status === "CANCELED") {
      const error: any = new Error("Vé này đã bị thu hồi/hủy trước đó!");
      error.statusCode = 400;
      throw error;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "REVOKED_BY_ADMIN" },
      });

      // Hoàn tiền nếu vé đã thanh toán bằng ví
      if (ticket.status === "CONFIRMED") {
        await tx.wallets.update({
          where: { userId: ticket.userId },
          data: { balance: { increment: ticket.trip.price } },
        });
      }

      return updated;
    });

    try {
      await MultiLevelCache.invalidate(`trips:detail:${ticket.tripId}`);
      await MultiLevelCache.invalidate("trips:all:active");
      await MultiLevelCache.invalidate(`user:${ticket.userId}:tickets*`);
    } catch (cacheErr: any) {
      console.warn("[BOOKING] Xóa cache thất bại:", cacheErr.message);
    }

    return result;
  }
}
