// FILE: Services/revocationService.ts
import prisma from "../database/prismaClient";
import NodeCache from "node-cache";
const myCache = new NodeCache({ stdTTL: 300 });
export class RevocationService {
  /**
   * THU HỒI TỰ ĐỘNG HÀNG LOẠT THEO BATCH ID (Dành cho sự cố tặng vé/tiền nhầm)
   */
  static async revokeBatch(batchId: string, adminUserId: number) {
    const cleanBatchId = batchId.trim();

    return await prisma.$transaction(async (tx) => {
      // 1. Lấy toàn bộ Log chưa bị Revoke
      const logs = await tx.auditLog.findMany({
        where: {
          batchId: { equals: cleanBatchId, mode: "insensitive" },
          isRevoked: false,
          action: { not: "BATCH_REVOKE_EXECUTE" },
        },
      });

      if (!logs || logs.length === 0) {
        throw new Error(
          `Không tìm thấy đợt tác động "${cleanBatchId}" hoặc đã bị thu hồi!`,
        );
      }

      let revokedUsersCount = 0;

      for (const log of logs) {
        const newDataObj = (
          typeof log.newData === "string"
            ? JSON.parse(log.newData)
            : log.newData
        ) as any;

        // 🎯 CASE 1: THU HỒI TẶNG TIỀN VÍ (MASS GIFT WALLET)
        if (log.action === "MASS_GIFT_EXECUTE") {
          const giftedAmount = Number(newDataObj?.amountPerUser || 0);
          const targetUserIds = newDataObj?.affectedUserIds || [];

          if (
            giftedAmount > 0 &&
            Array.isArray(targetUserIds) &&
            targetUserIds.length > 0
          ) {
            await tx.wallets.updateMany({
              where: { userId: { in: targetUserIds } },
              data: { balance: { decrement: giftedAmount } },
            });
            revokedUsersCount += targetUserIds.length;
          }
        }

        // 🎯 CASE 2: THU HỒI MUA VÉ / CẤP VÉ (TICKETS)
        // 🎯 CASE 2: THU HỒI MUA VÉ (Dựa trên thông tin bóc tách từ AuditLog)
        else if (
          log.action === "BOOK_TICKET_PAYMENT" ||
          log.action === "BOOK_TICKET_BATCH" ||
          log.action === "MASS_GIFT_TICKET" ||
          log.resource === "Tickets" ||
          log.resource === "Wallets"
        ) {
          // 1. Bóc tách thông tin từ newData của AuditLog
          const tripId = Number(newDataObj?.tripId);
          const seats: number[] = Array.isArray(newDataObj?.seats)
            ? newDataObj.seats.map((s: any) => Number(s))
            : [];
          const logUserId = log.userId;

          if (tripId && seats.length > 0 && logUserId) {
            // 2. Tìm chính xác các vé trong DB dựa theo tripId + seatNumber + userId
            const ticketsToRevoke = await tx.tickets.findMany({
              where: {
                tripId: tripId,
                seatNumber: { in: seats },
                userId: logUserId,
                status: "CONFIRMED",
              },
              include: { trip: true }, // Lấy kèm bảng Trips để lấy giá tiền (price)
            });

            if (ticketsToRevoke.length > 0) {
              const ticketIds = ticketsToRevoke.map((t) => t.id);

              // a. Đổi trạng thái vé sang REVOKED_BY_ADMIN (hoặc CANCELLED tùy Enum TicketStatus)
              await tx.tickets.updateMany({
                where: { id: { in: ticketIds } },
                data: { status: "REVOKED_BY_ADMIN" },
              });
              try {
                myCache.del(`trips:detail:${tripId}`);
              } catch (cacheErr) {
                console.warn(
                  "⚠️ Xóa Cache thất bại nhưng DB đã được Revoke:",
                  cacheErr,
                );
              }

              // b. Tính tổng tiền cần hoàn lại vào ví người dùng
              // Lấy giá trị tiền thực trả từ log (newData.amount là số âm -> Math.abs để ra số dương)
              const totalPaidFromLog = Math.abs(
                Number(newDataObj?.amount || 0),
              );

              // Nếu log có amount thì lấy luôn, nếu không thì lấy price từ bảng Trips * số lượng vé
              const totalRefund =
                totalPaidFromLog > 0
                  ? totalPaidFromLog
                  : ticketsToRevoke.reduce(
                      (sum, t) => sum + (Number(t.trip?.price) || 0),
                      0,
                    );

              if (totalRefund > 0) {
                // 1. Cộng tiền vào ví
                await tx.wallets.updateMany({
                  where: { userId: logUserId },
                  data: {
                    balance: { increment: totalRefund },
                  },
                });

                // 2. 🎯 TẠO LOG HOÀN TIỀN HIỂN THỊ TRÊN VÍ USER
                await tx.auditLog.create({
                  data: {
                    requestId: `REFUND_${Date.now()}`,
                    userId: logUserId, // ID của User nhận tiền hoàn
                    action: "REFUND_TICKET_PAYMENT",
                    batchId: cleanBatchId,
                    resource: "Wallets",
                    resourceId: String(logUserId),
                    newData: {
                      amount: totalRefund, // Số dương (+) để giao dịch hiện màu xanh
                      description: `Hoàn tiền ${ticketsToRevoke.length} vé chuyến đi (Do Admin thu hồi)`,
                      tripId,
                      seats,
                    },
                    isRevoked: false,
                  },
                });

                console.log(
                  `✅ [REVOKE SUCCESS] Đã cộng ${totalRefund} VNĐ và ghi Log hoàn tiền cho User ${logUserId}`,
                );
              }

              revokedUsersCount += ticketsToRevoke.length;
            }
          }
        }

        // Đánh dấu log đã bị thu hồi
        await tx.auditLog.update({
          where: { id: log.id },
          data: { isRevoked: true },
        });
      }

      // 3. Ghi lại Audit Log duy nhất cho hành động Revoke
      await tx.auditLog.create({
        data: {
          requestId: `REVOKE_${Date.now()}`,
          userId: adminUserId,
          action: "BATCH_REVOKE_EXECUTE",
          batchId: cleanBatchId,
          resource: "System",
          resourceId: cleanBatchId,
          newData: { revokedTotal: revokedUsersCount },
        },
      });

      return { success: true, revokedCount: revokedUsersCount };
    });
  }
}
