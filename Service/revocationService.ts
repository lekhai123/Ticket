import prisma from "../database/prismaClient";
import jwt from "jsonwebtoken";
import { redisPrimary } from "../Utils/redisLock";
import { MultiLevelCache } from "./cacheService";

export class RevocationService {
  // ============================================================
  // JWT REVOCATION (dùng cho logout + refresh rotation)
  // ============================================================

  /**
   * Đưa jti vào blacklist Redis với TTL = thời gian còn lại của token.
   * Token hết hạn tự nhiên thì không cần lưu (TTL <= 0).
   */
  static async revoke(jti: string, exp: number): Promise<void> {
    if (!jti || !exp) return;
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return;
    try {
      await redisPrimary.set(`revoked:${jti}`, "1", "EX", ttl);
    } catch (err: any) {
      console.error("[REVOKE] Không lưu được jti:", err.message);
    }
  }

  /**
   * Kiểm tra jti có nằm trong blacklist không.
   * Redis lỗi thì fail-open (trả false) để không chặn user oan.
   */
  static async isRevoked(jti?: string): Promise<boolean> {
    if (!jti) return false;
    try {
      return (await redisPrimary.get(`revoked:${jti}`)) === "1";
    } catch (err: any) {
      console.error("[REVOKE] Không đọc được jti:", err.message);
      return false;
    }
  }

  /**
   * Thu hồi cả cặp access + refresh khi logout.
   * Decode lấy jti + exp từng token rồi đưa vào blacklist.
   */
  static async revokePair(
    accessToken?: string,
    refreshToken?: string,
  ): Promise<void> {
    for (const t of [accessToken, refreshToken]) {
      if (!t) continue;
      try {
        const decoded: any = jwt.decode(t);
        if (decoded?.jti && decoded?.exp) {
          await this.revoke(decoded.jti, decoded.exp);
        }
      } catch {
        // token hỏng thì bỏ qua
      }
    }
  }

  // ============================================================
  // THU HỒI HÀNG LOẠT THEO BATCH ID (sự cố tặng vé/tiền nhầm)
  // ============================================================

  /**
   * Thu hồi toàn bộ tác động của một batch (tặng tiền, cấp vé...).
   * Duyệt từng audit log chưa revoke, hoàn tác theo loại action,
   * ghi log mới để hiển thị lịch sử ví cho user.
   */
  static async revokeBatch(batchId: string, adminUserId: number) {
    const cleanBatchId = batchId.trim();

    return await prisma.$transaction(async (tx) => {
      // Lấy toàn bộ log chưa bị revoke thuộc batch
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

        // Trường hợp 1: thu hồi tiền tặng hàng loạt
        if (log.action === "MASS_GIFT_EXECUTE") {
          const giftedAmount = Number(newDataObj?.amountPerUser || 0);
          const targetUserIds: number[] = newDataObj?.affectedUserIds || [];

          if (
            giftedAmount > 0 &&
            Array.isArray(targetUserIds) &&
            targetUserIds.length > 0
          ) {
            // Trừ tiền đồng loạt ở ví
            await tx.wallets.updateMany({
              where: { userId: { in: targetUserIds } },
              data: { balance: { decrement: giftedAmount } },
            });

            // Lấy ví mới để ghi audit log từng user
            const affectedWallets = await tx.wallets.findMany({
              where: { userId: { in: targetUserIds } },
              select: { id: true, userId: true, balance: true },
            });

            // Ghi log trừ tiền hiện trên lịch sử ví
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
                  amount: -giftedAmount,
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

        // Trường hợp 2: thu hồi vé (mua vé / cấp vé lỗi hệ thống)
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

              // Chuyển vé sang trạng thái đã thu hồi
              await tx.tickets.updateMany({
                where: { id: { in: ticketIds } },
                data: { status: "REVOKED_BY_ADMIN" },
              });

              // Xóa cache sơ đồ ghế + danh sách trip để availableSeats cập nhật
              try {
                await MultiLevelCache.invalidate(`trips:detail:${tripId}`);
                await MultiLevelCache.invalidate("trips:all:active");
              } catch (cacheErr) {
                console.warn("Xóa cache thất bại:", cacheErr);
              }

              // Số tiền user thực tế đã bỏ ra mua vé
              const actualPaidAmount = Math.abs(
                Number(newDataObj?.amount || 0),
              );

              // Chỉ hoàn tiền nếu user thực sự có trả tiền
              if (actualPaidAmount > 0) {
                const updatedWallet = await tx.wallets.update({
                  where: { userId: logUserId },
                  data: { balance: { increment: actualPaidAmount } },
                  select: { id: true, balance: true },
                });

                const currentBalance = Number(updatedWallet.balance);

                // Ghi log hoàn tiền hiện trên lịch sử ví
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
                      amount: actualPaidAmount,
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

        // Đánh dấu log đã revoke
        await tx.auditLog.update({
          where: { id: log.id },
          data: { isRevoked: true },
        });
      }

      // Ghi log tổng kết cho admin
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
