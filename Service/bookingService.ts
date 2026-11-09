import prisma from "../database/prismaClient";
import {
  sendNotificationEmail,
  scheduleNotificationWithReset,
} from "../queues/mailQueue";
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
    const t0 = Date.now();

    const lockKey = `lock:trip:${tripId}:seat:${seatNumber}`;
    const lockToken = await RedisLock.acquire(lockKey, 30);
    const t1 = Date.now();

    if (!lockToken) {
      const error: any = new Error(
        `Ghế số ${seatNumber} đang có người khác thao tác chọn.`,
      );
      error.statusCode = 409;
      throw error;
    }

    let result: any;

    try {
      result = await prisma.$transaction(
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
          const tripPrice = Number(trip.price);
          let walletId = userId;

          if (paymentMethod === "WALLET") {
            const wallet = await tx.wallets.findUnique({ where: { userId } });
            if (!wallet || wallet.isLocked) {
              const error: any = new Error(
                "Ví của bạn đang bị khóa do vi phạm hoặc chờ đối soát. Vui lòng liên hệ Admin!",
              );
              error.statusCode = 403;
              throw error;
            }
            currentBalance = Number(wallet.balance || 0);
            walletId = wallet.id;
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

          // Include user luôn trong create → không cần query thêm để lấy email
          const newTicket = await tx.tickets.create({
            data: {
              userId,
              tripId,
              seatNumber,
              status: initialStatus,
              paymentMethod: paymentMethod === "WALLET" ? "WALLET" : "LATER",
              paidAmount: paymentMethod === "WALLET" ? tripPrice : 0,
              ...(batchId ? { batchId } : {}),
            } as any,
            include: { user: { select: { email: true } } },
          });

          if (paymentMethod === "WALLET") {
            await tx.auditLog.create({
              data: {
                requestId: `BOOK_TICKET_${Date.now()}`,
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
                  tripId,
                  seats: [seatNumber],
                  ticketId: newTicket.id,
                },
              },
            });
          }

          return newTicket;
        },
        { timeout: 15000 },
      );
    } finally {
      await RedisLock.release(lockKey, lockToken);
    }
    const t2 = Date.now();

    // AWAIT mail scheduling — BẮT BUỘC trên serverless
    // Chỉ là 1 Redis write (~50–100ms), KHÔNG gửi mail thật (worker gửi)
    if (paymentMethod === "WALLET" && result?.id && result?.user?.email) {
      try {
        const effectiveBatchId = batchId || `SINGLE_${result.id}`;
        await scheduleNotificationWithReset(
          {
            email: result.user.email,
            type: "BOOKING_SUCCESS_BATCH",
            data: { userId, batchId: effectiveBatchId },
          },
          {
            delayMs: 10000,
            jobId: `booking-notif-${effectiveBatchId}`, //  SỬA DẤU : THÀNH -
          },
        );
      } catch (mailErr: any) {
        console.error("[BOOKING] Schedule mail error:", mailErr?.message);
      }
    }
    const t3 = Date.now();

    // Cache invalidation — có thể để trôi, không quan trọng
    void Promise.all([
      MultiLevelCache.invalidate(`trips:detail:${tripId}`),
      MultiLevelCache.invalidate("trips:all:active"),
    ]).catch((err) =>
      console.warn("[BOOKING] cache invalidation:", err?.message),
    );

    // ⏱️ TIMING LOG — xoá sau khi debug xong
    console.log(
      `[TIMING][BOOK] lock=${t1 - t0}ms tx=${t2 - t1}ms mail=${t3 - t2}ms total=${t3 - t0}ms`,
    );

    return result;
  }

  static async adminRevokeTicket(
    ticketId: number,
    adminUserId: number,
    reason: string = "Admin thu hồi thủ công",
  ) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true, user: true },
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

      let refundAmount = 0;
      if (ticket.status === "CONFIRMED") {
        refundAmount = Number(ticket.paidAmount ?? ticket.trip.price ?? 0);
      }

      if (refundAmount > 0) {
        const wallet = await tx.wallets.findUnique({
          where: { userId: ticket.userId },
        });
        if (!wallet) {
          throw new Error(
            "Không tìm thấy ví để hoàn tiền! Dữ liệu vé bất thường.",
          );
        }
        const currentBalance = Number(wallet.balance || 0);

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
            resourceId: String(wallet.id),
            oldData: { balance: currentBalance },
            newData: {
              amount: refundAmount,
              description: `Hoàn tiền vé bị thu hồi (Chuyến ${ticket.trip.route}, Ghế A${ticket.seatNumber}). Lý do: ${reason}`,
              newBalance: currentBalance + refundAmount,
            },
          },
        });
      }

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
            performedByAdminId: adminUserId,
          },
        },
      });

      return updated;
    });

    // AWAIT mail scheduling
    if (ticket.user) {
      try {
        const effectiveBatchId =
          (ticket as any).batchId || `SINGLE_${ticket.id}`;
        await scheduleNotificationWithReset(
          {
            email: ticket.user.email,
            type: "ADMIN_REVOKE_BATCH",
            data: {
              userId: ticket.userId,
              batchId: effectiveBatchId,
              reason,
            },
          },
          {
            delayMs: 30000,
            jobId: `revoke-notif-${effectiveBatchId}`, // SỬA DẤU : THÀNH -
          },
        );
      } catch (mailErr: any) {
        console.error("[BOOKING] Schedule revoke mail:", mailErr?.message);
      }
    }

    void Promise.all([
      MultiLevelCache.invalidate(`trips:detail:${ticket.tripId}`),
      MultiLevelCache.invalidate("trips:all:active"),
      MultiLevelCache.invalidate(`user:${ticket.userId}:tickets*`),
    ]).catch((err) =>
      console.warn("[BOOKING] cache invalidation:", err?.message),
    );

    return result;
  }

  static async cancelTicket(userId: number, ticketId: number) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: { trip: true, user: true },
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

      if (ticket.status === "CONFIRMED") {
        const refundAmount = Number(
          ticket.paidAmount ?? ticket.trip.price ?? 0,
        );
        if (refundAmount > 0) {
          const wallet = await tx.wallets.findUnique({
            where: { userId },
          });
          if (!wallet) {
            throw new Error("Không tìm thấy ví để hoàn tiền!");
          }
          const currentBalance = Number(wallet.balance || 0);

          await tx.wallets.update({
            where: { userId },
            data: { balance: { increment: refundAmount } },
          });

          await tx.auditLog.create({
            data: {
              requestId: `REFUND_TICKET_${Date.now()}`,
              userId,
              action: "REFUND_TICKET_PAYMENT",
              resource: "Wallets",
              resourceId: String(wallet.id),
              oldData: { balance: currentBalance },
              newData: {
                amount: refundAmount,
                description: `Hoàn tiền hủy vé chuyến ${ticket.trip.route} (Ghế A${ticket.seatNumber})`,
                newBalance: currentBalance + refundAmount,
              },
            },
          });
        }
      }

      return updatedTicket;
    });

    // AWAIT mail (mail hủy đơn lẻ, không cần batch)
    if (ticket.user) {
      try {
        await sendNotificationEmail({
          email: ticket.user.email,
          type: "BOOKING_CANCEL",
          data: { route: ticket.trip.route },
        });
      } catch (mailErr: any) {
        console.error("[BOOKING] Hủy vé mail error:", mailErr?.message);
      }
    }

    void Promise.all([
      MultiLevelCache.invalidate(`trips:detail:${ticket.tripId}`),
      MultiLevelCache.invalidate("trips:all:active"),
      MultiLevelCache.invalidate(`user:${userId}:tickets*`),
    ]).catch((err) =>
      console.warn("[BOOKING] cache invalidation:", err?.message),
    );

    return result;
  }
}
