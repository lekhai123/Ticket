import prisma from "../database/prismaClient";
import jwt from "jsonwebtoken";
import { redisPrimary } from "../Utils/redisLock";
import { MultiLevelCache } from "./cacheService";
import {
  sendNotificationEmail,
  NotificationJobData,
} from "../queues/mailQueue";

export class RevocationService {
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

  static async isRevoked(jti?: string): Promise<boolean> {
    if (!jti) return false;
    try {
      return (await redisPrimary.get(`revoked:${jti}`)) === "1";
    } catch (err: any) {
      console.error("[REVOKE] Không đọc được jti:", err.message);
      return false;
    }
  }

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

  static async revokeBatch(batchId: string, adminUserId: number) {
    const cleanBatchId = batchId.trim();

    const emailsToSend: {
      email: string;
      type: NotificationJobData["type"];
      data: Record<string, any>;
    }[] = [];

    const affectedUserIdsList = new Set<number>();

    const result = await prisma.$transaction(async (tx) => {
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

        if (log.action === "MASS_GIFT_EXECUTE") {
          const giftedAmount = Number(newDataObj?.amountPerUser || 0);
          const targetUserIds: number[] = newDataObj?.affectedUserIds || [];

          if (
            giftedAmount > 0 &&
            Array.isArray(targetUserIds) &&
            targetUserIds.length > 0
          ) {
            await tx.wallets.updateMany({
              where: { userId: { in: targetUserIds } },
              data: { balance: { decrement: giftedAmount } },
            });

            const affectedWallets = await tx.wallets.findMany({
              where: { userId: { in: targetUserIds } },
              select: {
                id: true,
                userId: true,
                balance: true,
                user: { select: { email: true } },
              },
            });

            const revokeWalletLogs = affectedWallets.map((w) => {
              const currentBalance = Number(w.balance);
              targetUserIds.forEach((id) => affectedUserIdsList.add(id));

              if (w.user?.email) {
                emailsToSend.push({
                  email: w.user.email,
                  type: "ADMIN_REVOKE_GIFT",
                  data: {
                    amount: giftedAmount,
                    reason: `Admin thu hồi quà tặng (Đợt: ${cleanBatchId})`,
                  },
                });
              }

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
        } else if (
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

              await tx.tickets.updateMany({
                where: { id: { in: ticketIds } },
                data: { status: "REVOKED_BY_ADMIN" },
              });

              try {
                await MultiLevelCache.invalidate(`trips:detail:${tripId}`);
                await MultiLevelCache.invalidate("trips:all:active");
              } catch (cacheErr) {
                console.warn("Xóa cache thất bại:", cacheErr);
              }

              const actualPaidAmount = Math.abs(
                Number(newDataObj?.amount || 0),
              );

              const user = await tx.users.findUnique({
                where: { id: logUserId },
                select: { email: true },
              });

              if (user?.email) {
                affectedUserIdsList.add(logUserId);
                emailsToSend.push({
                  email: user.email,
                  type: "ADMIN_REVOKE_BATCH",
                  data: {
                    userId: logUserId,
                    batchId: cleanBatchId,
                    reason: `Hệ thống thu hồi vé theo đợt (${cleanBatchId})`,
                  },
                });
              }

              if (actualPaidAmount > 0) {
                const updatedWallet = await tx.wallets.update({
                  where: { userId: logUserId },
                  data: { balance: { increment: actualPaidAmount } },
                  select: { id: true, balance: true },
                });

                const currentBalance = Number(updatedWallet.balance);

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

        await tx.auditLog.update({
          where: { id: log.id },
          data: { isRevoked: true },
        });
      }

      await tx.auditLog.create({
        data: {
          requestId: `REVOKE_SUMMARY_${Date.now()}`,
          userId: adminUserId,
          action: "BATCH_REVOKE_EXECUTE",
          batchId: cleanBatchId,
          resource: "System",
          resourceId: cleanBatchId,
          newData: {
            revokedTotal: revokedUsersCount,
            performedByAdminId: adminUserId,
            affectedUserIds: Array.from(affectedUserIdsList),
            targetType: "ALL",
          },
        },
      });

      return { success: true, revokedCount: revokedUsersCount };
    });

    emailsToSend.forEach((payload) => {
      sendNotificationEmail(payload).catch((err) => {
        console.error(
          `[REVOKE] Lỗi đẩy job gửi mail cho ${payload.email}:`,
          err?.message,
        );
      });
    });

    return result;
  }
}
