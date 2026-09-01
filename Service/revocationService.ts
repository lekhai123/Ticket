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
      // 1. Lấy toàn bộ Log chưa bị Revoke thuộc Batch
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

        // =========================================================================
        // 🎯 CASE 1: THU HỒI TIỀN TẶNG HÀNG LOẠT (MASS GIFT WALLET)
        // =========================================================================
        if (log.action === "MASS_GIFT_EXECUTE") {
          const giftedAmount = Number(newDataObj?.amountPerUser || 0);
          const targetUserIds: number[] = newDataObj?.affectedUserIds || [];

          if (
            giftedAmount > 0 &&
            Array.isArray(targetUserIds) &&
            targetUserIds.length > 0
          ) {
            // a. Trừ tiền đồng loạt ở bảng Wallets
            await tx.wallets.updateMany({
              where: { userId: { in: targetUserIds } },
              data: { balance: { decrement: giftedAmount } },
            });

            // b. 🎯 BỔ SUNG: Lấy thông tin ví mới để ghi AuditLog cho TỪNG USER
            const affectedWallets = await tx.wallets.findMany({
              where: { userId: { in: targetUserIds } },
              select: { id: true, userId: true, balance: true },
            });

            // c. 🎯 BỔ SUNG: Tạo Log trừ tiền hiển thị trên Lịch sử Ví của User
            const revokeWalletLogs = affectedWallets.map((w) => {
              const currentBalance = Number(w.balance);
              return {
                requestId: `REVOKE_GIFT_${Date.now()}_${w.userId}`,
                userId: w.userId,
                action: "MASS_GIFT_REVOKED",
                batchId: cleanBatchId,
                resource: "Wallets",
                resourceId: String(w.id),
                oldData: { balance: currentBalance + giftedAmount },
                newData: {
                  amount: -giftedAmount, // Số âm (-) để UI Lịch sử Ví hiện màu đỏ/trừ tiền
                  description: `Admin thu hồi quà tặng tiền ví (Đợt: ${cleanBatchId})`,
                  newBalance: currentBalance,
                },
                isRevoked: false,
              };
            });

            await tx.auditLog.createMany({
              data: revokeWalletLogs,
            });

            revokedUsersCount += targetUserIds.length;
          }
        }

        // =========================================================================
        // 🎯 CASE 2: THU HỒI MUA VÉ / CẤP VÉ LỖI HỆ THỐNG (TICKETS)
        // =========================================================================
        else if (
          log.action === "BOOK_TICKET_PAYMENT" ||
          log.action === "BOOK_TICKET_BATCH" ||
          log.action === "MASS_GIFT_TICKET" ||
          log.resource === "Tickets"
        ) {
          const tripId = Number(newDataObj?.tripId);
          const seats: number[] = Array.isArray(newDataObj?.seats)
            ? newDataObj.seats.map((s: any) => Number(s))
            : [];
          const logUserId = log.userId;

          if (tripId && seats.length > 0 && logUserId) {
            // Tìm vé còn hiệu lực
            const ticketsToRevoke = await tx.tickets.findMany({
              where: {
                tripId: tripId,
                seatNumber: { in: seats },
                userId: logUserId,
                status: "CONFIRMED",
              },
            });

            if (ticketsToRevoke.length > 0) {
              const ticketIds = ticketsToRevoke.map((t) => t.id);

              // a. Chuyển trạng thái vé sang REVOKED_BY_ADMIN (Không xóa hẳn khỏi CSDL)
              await tx.tickets.updateMany({
                where: { id: { in: ticketIds } },
                data: { status: "REVOKED_BY_ADMIN" },
              });

              // Xóa cache để sơ đồ ghế lập tức nhả trống các ghế này
              try {
                myCache.del(`trips:detail:${tripId}`);
              } catch (cacheErr) {
                console.warn("⚠️ Xóa Cache thất bại:", cacheErr);
              }

              // b. Kiểm tra số tiền THỰC TẾ user đã bỏ ra mua vé trong Log
              const actualPaidAmount = Math.abs(
                Number(newDataObj?.amount || 0),
              );

              // Chỉ hoàn tiền NẾU User thực sự có bỏ tiền mua (actualPaidAmount > 0)
              if (actualPaidAmount > 0) {
                const updatedWallet = await tx.wallets.update({
                  where: { userId: logUserId },
                  data: { balance: { increment: actualPaidAmount } },
                  select: { id: true, balance: true },
                });

                const currentBalance = Number(updatedWallet.balance);

                // 🎯 Tạo Log hoàn tiền hiển thị trên Lịch sử Ví
                await tx.auditLog.create({
                  data: {
                    requestId: `REFUND_${Date.now()}_${logUserId}`,
                    userId: logUserId,
                    action: "REFUND_TICKET_PAYMENT",
                    batchId: cleanBatchId,
                    resource: "Wallets",
                    resourceId: String(updatedWallet.id),
                    oldData: { balance: currentBalance - actualPaidAmount },
                    newData: {
                      amount: actualPaidAmount, // Số dương (+), hiển thị màu xanh
                      description: `Hoàn tiền ${ticketsToRevoke.length} vé chuyến #${tripId} (Thu hồi đợt lỗi hệ thống)`,
                      newBalance: currentBalance,
                      tripId,
                      seats,
                    },
                    isRevoked: false,
                  },
                });
              }

              revokedUsersCount += ticketsToRevoke.length;
            }
          }
        }

        // Đánh dấu dòng log này đã bị Thu hồi
        await tx.auditLog.update({
          where: { id: log.id },
          data: { isRevoked: true },
        });
      }

      // 3. Ghi lại Summary Audit Log cho Admin
      await tx.auditLog.create({
        data: {
          requestId: `REVOKE_SUMMARY_${Date.now()}`,
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
