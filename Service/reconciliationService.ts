import prisma from "../database/prismaClient"; // Dùng singleton Prisma
import { AIReconciliationAnalyzer } from "./aiReconciliationAnalyzer.service";

export interface MismatchDetail {
  userId: number;
  walletId: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  status: "DEBITED_AND_FROZEN" | "DEBT_GENERATED_AND_FROZEN";
}

export class ReconciliationService {
  static async runDailyReconciliation() {
    console.log(
      "[RECONCILIATION] Bắt đầu tiến trình đối soát & Tự động phục hồi...",
    );
    const startTime = Date.now();

    // THÊM BATCH ID CHUNG CHO CẢ ĐỢT ĐỐI SOÁT
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

            if (rawAmount < 0) {
              calculatedBalance += rawAmount;
            } else {
              if (
                ["TOP_UP", "MASS_GIFT", "REFUND", "CREDIT"].some((a) =>
                  action.includes(a),
                )
              ) {
                calculatedBalance += rawAmount;
              } else if (
                ["BOOK_TICKET", "REVOKE", "WITHDRAW", "DEBIT"].some((a) =>
                  action.includes(a),
                )
              ) {
                calculatedBalance -= rawAmount;
              }
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
                    batchId: reconBatchId, // ✅ ĐÃ THÊM BATCH ID VÀO ĐÂY
                    resource: "Wallets",
                    resourceId: wallet.id.toString(),
                    oldData: { actualBalance, isLocked: wallet.isLocked },
                    newData: {
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
        aiAnalysis = await AIReconciliationAnalyzer.analyzeMismatches(
          mismatchedAccounts,
          totalWalletsChecked,
          logsSample,
        );
      } catch (aiError: any) {
        console.error(
          "[RECONCILIATION] Lỗi khi gọi AI phân tích:",
          aiError.message,
        );
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
