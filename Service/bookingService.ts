import prisma from "../database/prismaClient";
import { RedisLock } from "../Utils/redisLock";
import { MultiLevelCache } from "./cacheService";

export class BookingService {
  static async holdOrBookSeat(
    userId: number,
    tripId: number,
    seatNumber: number,
    paymentMethod: "WALLET" | "LATER" = "WALLET",
    batchId?: string,
  ) {
    const lockKey = `lock:trip:${tripId}:seat:${seatNumber}`;
    const lockToken = await RedisLock.acquire(lockKey, 30);
    if (!lockToken) {
      const error: any = new Error(
        `Ghế số ${seatNumber} đang có người khác thao tác chọn.`,
      );
      error.statusCode = 409;
      throw error;
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`seat:${tripId}:${seatNumber}`}))::text`;

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

          const trip = await tx.trips.findUnique({ where: { id: tripId } });
          if (!trip) {
            const error: any = new Error("Chuyến xe không tồn tại!");
            error.statusCode = 404;
            throw error;
          }

          let initialStatus: "HELD" | "PENDING" | "CONFIRMED" = "PENDING";
          let currentBalance = 0;
          let tripPrice = Number(trip.price);
          let walletId = userId;

          if (paymentMethod === "WALLET") {
            const wallet = await tx.wallets.findUnique({ where: { userId } });
            currentBalance = Number(wallet?.balance || 0);
            walletId = wallet?.id || userId;

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

          const newTicket = await tx.tickets.create({
            data: {
              userId,
              tripId,
              seatNumber,
              status: initialStatus,
              // Lưu lại phương thức thanh toán và số tiền thực trả để sau này hoàn tiền chuẩn
              paymentMethod: paymentMethod === "WALLET" ? "WALLET" : "LATER",
              paidAmount: paymentMethod === "WALLET" ? tripPrice : 0,
            },
          });

          if (paymentMethod === "WALLET") {
            await tx.auditLog.create({
              data: {
                requestId: `BOOK_TICKET_${Date.now()}`,
                // Quy ước batchId theo chuyến xe để Admin dễ thu hồi hàng loạt
                batchId: batchId || `TRIP_${tripId}`,
                userId,
                action: "BOOK_TICKET_PAYMENT",
                resource: "Wallets",
                resourceId: String(walletId),
                oldData: { balance: currentBalance },
                newData: {
                  amount: -tripPrice,
                  description: `Thanh toán vé chuyến ${trip.route} (Ghế A${seatNumber})`,
                  newBalance: currentBalance - tripPrice,
                  tripId: tripId,
                  seats: [seatNumber],
                  ticketId: newTicket.id,
                },
              },
            });
          }

          return newTicket;
        },
        { timeout: 25000 },
      );

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
   * ADMIN THU HỒI VÉ LẺ (Xử lý triệt để lỗi DB, bug, chuyển nhầm)
   */
  static async adminRevokeTicket(
    ticketId: number,
    reason: string = "Admin thu hồi thủ công",
  ) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true },
    });

    if (!ticket) throw new Error("Không tìm thấy vé!");
    if (ticket.status === "REVOKED_BY_ADMIN" || ticket.status === "CANCELED") {
      throw new Error("Vé này đã bị thu hồi/hủy trước đó!");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.tickets.update({
        where: { id: ticketId },
        data: { status: "REVOKED_BY_ADMIN" },
      });

      //  LOGIC HOÀN TIỀN THÔNG MINH: Chỉ hoàn nếu user thực sự bỏ tiền ra mua
      let refundAmount = 0;
      if (ticket.status === "CONFIRMED") {
        if (
          ticket.paymentMethod === "WALLET" ||
          ticket.paymentMethod === "LEGACY"
        ) {
          refundAmount = Number(ticket.paidAmount || ticket.trip.price);
        }
        // Nếu là vé GIFT, ADMIN_GRANT, LATER, hoặc paidAmount = 0 -> refundAmount giữ nguyên = 0 (Không hoàn tiền)
      }

      if (refundAmount > 0) {
        const wallet = await tx.wallets.findUnique({
          where: { userId: ticket.userId },
        });
        const currentBalance = Number(wallet?.balance || 0);

        await tx.wallets.update({
          where: { userId: ticket.userId },
          data: { balance: { increment: refundAmount } },
        });

        await tx.auditLog.create({
          data: {
            requestId: `ADMIN_REVOKE_REFUND_${Date.now()}`,
            userId: ticket.userId,
            action: "REFUND_TICKET_PAYMENT",
            batchId: `ADMIN_REVOKE_${ticketId}`,
            resource: "Wallets",
            resourceId: String(wallet?.id || ticket.userId),
            oldData: { balance: currentBalance },
            newData: {
              amount: refundAmount,
              description: `Hoàn tiền vé bị thu hồi (Chuyến ${ticket.trip.route}, Ghế A${ticket.seatNumber}). Lý do: ${reason}`,
              newBalance: currentBalance + refundAmount,
            },
          },
        });
      }

      // Ghi log thu hồi vé
      await tx.auditLog.create({
        data: {
          requestId: `ADMIN_REVOKE_TICKET_${Date.now()}`,
          userId: ticket.userId,
          action: "ADMIN_REVOKE_TICKET",
          resource: "Tickets",
          resourceId: String(ticketId),
          oldData: { status: ticket.status },
          newData: {
            status: "REVOKED_BY_ADMIN",
            reason,
            refunded: refundAmount,
          },
        },
      });

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

  // (Hàm cancelTicket của User giữ nguyên như code cũ của bạn)
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
        const wallet = await tx.wallets.findUnique({ where: { userId } });
        const currentBalance = Number(wallet?.balance || 0);
        const refundAmount = Number(ticket.trip.price);

        // 1. Cộng tiền vào ví
        await tx.wallets.update({
          where: { userId },
          data: { balance: { increment: refundAmount } },
        });

        // GHI LOG HOÀN TIỀN
        await tx.auditLog.create({
          data: {
            requestId: `REFUND_TICKET_${Date.now()}`,
            userId,
            action: "REFUND_TICKET_PAYMENT",
            resource: "Wallets",
            resourceId: String(wallet?.id || userId),
            oldData: { balance: currentBalance },
            newData: {
              amount: refundAmount,
              description: `Hoàn tiền hủy vé chuyến ${ticket.trip.route} (Ghế A${ticket.seatNumber})`,
              newBalance: currentBalance + refundAmount,
            },
          },
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
}
