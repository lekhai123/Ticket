import prisma from "../database/prismaClient";
import { AIReconciliationAnalyzer } from "./aiReconciliationAnalyzer.service";
import { sendNotificationEmail } from "../queues/mailQueue";

export interface MismatchDetail {
  userId: number;
  walletId: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  status: "DEBITED_AND_FROZEN" | "DEBT_GENERATED_AND_FROZEN";
}

const ACTION_SIGN: Record<string, 1 | -1> = {
  TOP_UP: 1,
  MASS_GIFT_RECEIVED: 1,
  MASS_GIFT: 1,
  REFUND_TICKET_PAYMENT: 1,
  CANCEL_TICKET_REFUND: 1,
  CREDIT: 1,

  BOOK_TICKET_PAYMENT: -1,
  BOOK_TICKET_BATCH: -1,
  MASS_GIFT_REVOKED: -1,
  REVOKE_BATCH: -1,
  WITHDRAW: -1,
  DEBIT: -1,
  SYSTEM_AUTO_DEBIT_AND_FREEZE: -1,
};

export class ReconciliationService {
  static async runDailyReconciliation() {
    console.log(
      "[RECONCILIATION] Bắt đầu tiến trình đối soát & Tự động phục hồi...",
    );
    const startTime = Date.now();

    const reconBatchId = `AIOPS_RECON_${new Date().toISOString().split("T")[0]}`;

    const mismatchedAccounts: MismatchDetail[] = [];
    let totalWalletsChecked = 0;
    let cursorId: number | undefined = undefined;
    const BATCH_SIZE = 100;

    try {
      while (true) {
        const wallets = await prisma.wallets.findMany({
          take: BATCH_SIZE,
          skip: cursorId ? 1 : 0,
          cursor: cursorId ? { id: cursorId } : undefined,
          orderBy: { id: "asc" },
          include: { user: { select: { email: true, fullName: true } } },
        });

        if (wallets.length === 0) break;
        cursorId = wallets[wallets.length - 1].id;
        totalWalletsChecked += wallets.length;

        const userIds = wallets.map((w) => w.userId);

        const allAuditLogs = await prisma.auditLog.findMany({
          where: {
            userId: { in: userIds },
            resource: "Wallets",
            action: {
              notIn: [
                "SYSTEM_ALERT_BALANCE_MISMATCH",
                "SYSTEM_AUTO_DEBIT_AND_FREEZE",
                "ADMIN_UNLOCK_WALLET",
              ],
            },
          },
          orderBy: { createdAt: "asc" },
        });

        const logsByUser = new Map<number, typeof allAuditLogs>();
        for (const log of allAuditLogs) {
          if (!log.userId) continue;
          if (!logsByUser.has(log.userId)) logsByUser.set(log.userId, []);
          logsByUser.get(log.userId)!.push(log);
        }

        for (const wallet of wallets) {
          const auditLogs = logsByUser.get(wallet.userId) || [];
          let calculatedBalance = 0;

          for (const log of auditLogs) {
            const newData = log.newData as Record<string, any> | null;
            if (!newData || typeof newData.amount !== "number") continue;

            const rawAmount = newData.amount;
            const action = log.action.toUpperCase();
            const sign = ACTION_SIGN[action];

            if (sign === 1) {
              calculatedBalance += Math.abs(rawAmount);
            } else if (sign === -1) {
              calculatedBalance -= Math.abs(rawAmount);
            } else {
              calculatedBalance += rawAmount;
            }
          }

          const actualBalance = Number(wallet.balance);
          const difference = Number(
            (actualBalance - calculatedBalance).toFixed(2),
          );

          if (Math.abs(difference) > 0.001) {
            const isDebt = calculatedBalance < 0;

            mismatchedAccounts.push({
              userId: wallet.userId,
              walletId: wallet.id,
              expectedBalance: calculatedBalance,
              actualBalance: actualBalance,
              difference: difference,
              status: isDebt
                ? "DEBT_GENERATED_AND_FROZEN"
                : "DEBITED_AND_FROZEN",
            });

            try {
              await prisma.$transaction(async (tx) => {
                await tx.wallets.update({
                  where: { id: wallet.id },
                  data: { balance: calculatedBalance, isLocked: true },
                });

                const lastLog = auditLogs[auditLogs.length - 1];
                if (lastLog?.ipAddress && lastLog.ipAddress !== "127.0.0.1") {
                  await tx.blacklistedIPs.upsert({
                    where: { ipAddress: lastLog.ipAddress },
                    update: {
                      isResolved: false,
                      reason: `Chênh lệch tài chính Ví #${wallet.id}`,
                    },
                    create: {
                      ipAddress: lastLog.ipAddress,
                      userId: wallet.userId,
                      reason: `Cảnh báo đối soát: Số dư thực tế ${actualBalance}đ vs Lý thuyết ${calculatedBalance}đ`,
                    },
                  });
                }

                await tx.auditLog.create({
                  data: {
                    requestId: `AIOPS-RECON-${Date.now()}-${wallet.id}`,
                    userId: wallet.userId,
                    action: "SYSTEM_AUTO_DEBIT_AND_FREEZE",
                    batchId: reconBatchId,
                    resource: "Wallets",
                    resourceId: wallet.id.toString(),
                    oldData: { actualBalance, isLocked: wallet.isLocked },
                    newData: {
                      amount: -difference,
                      adjustedAmount: -difference,
                      newBalance: calculatedBalance,
                      isLocked: true,
                      isDebt: isDebt,
                      reason: isDebt
                        ? "Khấu trừ khoản tiền không hợp lệ đã tiêu xài -> Ví ghi nợ âm & Khóa ví"
                        : "Cân bằng lại số dư chuẩn & Khóa ví chờ Admin duyệt",
                    },
                    ipAddress: "127.0.0.1 (CRON_AIOPS)",
                  },
                });
              });

              if (wallet.user?.email) {
                await sendNotificationEmail({
                  email: wallet.user.email,
                  type: "WALLET_LOCKED_AI",
                  data: {
                    userName: wallet.user.fullName,
                    actualBalance: actualBalance,
                    calculatedBalance: calculatedBalance,
                  },
                }).catch((err) =>
                  console.error(
                    "[RECONCILIATION] Lỗi đẩy job gửi mail khóa ví:",
                    err,
                  ),
                );
              }
            } catch (txError: any) {
              console.error(
                `[RECONCILIATION] Lỗi khi xử lý ví ${wallet.id}:`,
                txError.message,
              );
            }
          }
        }
      }
    } catch (error: any) {
      console.error("[RECONCILIATION] Lỗi quét ví:", error.message);
    }

    const duration = Date.now() - startTime;

    let logsSample: any[] = [];
    let aiAnalysis = null;

    if (mismatchedAccounts.length > 0) {
      logsSample = await prisma.auditLog.findMany({
        where: { userId: { in: mismatchedAccounts.map((a) => a.userId) } },
        take: 15,
        orderBy: { createdAt: "desc" },
      });

      try {
        const aiPromise = AIReconciliationAnalyzer.analyzeMismatches(
          mismatchedAccounts,
          totalWalletsChecked,
          logsSample,
        );

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI_TIMEOUT")), 15000),
        );

        aiAnalysis = (await Promise.race([aiPromise, timeoutPromise])) as any;
      } catch (aiError: any) {
        console.error(
          "[RECONCILIATION] Lỗi khi gọi AI phân tích:",
          aiError.message,
        );
        aiAnalysis = {
          riskLevel: "HIGH",
          rootCauseAnalysis:
            "Hệ thống AI phản hồi quá chậm hoặc đang quá tải. Vui lòng thử lại sau.",
          recommendedAction:
            "Kiểm tra thủ công danh sách mảng mismatchedAccounts.",
        };
      }
    }

    return {
      success: true,
      totalWalletsChecked,
      mismatchCount: mismatchedAccounts.length,
      mismatchedAccounts,
      durationMs: duration,
      aiAnalysis,
    };
  }
}
