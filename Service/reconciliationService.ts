// src/services/reconciliationService.ts
import { PrismaClient } from "@prisma/client";
import { AIReconciliationAnalyzer } from "../Service/aiReconciliationAnalyzer.service";

const prisma = new PrismaClient();

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
    console.log("🔄 [AIOps] Bắt đầu tiến trình đối soát & Tự động phục hồi...");

    const startTime = Date.now();
    const mismatchedAccounts: MismatchDetail[] = [];

    const wallets = await prisma.wallets.findMany({
      include: {
        user: { select: { email: true, fullName: true } },
      },
    });

    for (const wallet of wallets) {
      // 1. Quét chuỗi vết AuditLog (Loại bỏ log cảnh báo hệ thống)
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          userId: wallet.userId,
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

      // 2. Tính số dư lý thuyết (expectedBalance)
      let calculatedBalance = 0;

      for (const log of auditLogs) {
        const newData = log.newData as Record<string, any> | null;
        if (!newData) continue;

        if (typeof newData.amount === "number") {
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
      }

      const actualBalance = Number(wallet.balance);
      const difference = Number((actualBalance - calculatedBalance).toFixed(2));

      // 3. Nếu phát hiện chênh lệch (Difference != 0)
      if (Math.abs(difference) > 0.001) {
        const isDebt = calculatedBalance < 0;

        mismatchedAccounts.push({
          userId: wallet.userId,
          walletId: wallet.id,
          expectedBalance: calculatedBalance,
          actualBalance: actualBalance,
          difference: difference,
          status: isDebt ? "DEBT_GENERATED_AND_FROZEN" : "DEBITED_AND_FROZEN",
        });

        // 4. Xử lý Auto-Remediation & Tự động ghi Nợ/Cân bằng số dư
        await prisma.$transaction(async (tx) => {
          // A. Đưa ví về số dư chuẩn (Nếu calculatedBalance < 0 -> Ví thành số âm) & Khóa ví
          await tx.wallets.update({
            where: { id: wallet.id },
            data: {
              balance: calculatedBalance, // Đưa thẳng về expectedBalance (Dương hoặc Âm)
              isLocked: true, // Khóa ví
            },
          });

          // B. Lấy IP gần nhất của User từ AuditLog để chèn vào Blacklist IP
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

          // C. Ghi AuditLog tự động trừ tiền & khóa ví
          await tx.auditLog.create({
            data: {
              requestId: `AIOPS-RECON-${Date.now()}`,
              userId: wallet.userId,
              action: "SYSTEM_AUTO_DEBIT_AND_FREEZE",
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
      }
    }

    const duration = Date.now() - startTime;

    // 5. Tích hợp AI Proxy phân tích Root Cause
    let logsSample: any[] = [];
    if (mismatchedAccounts.length > 0) {
      logsSample = await prisma.auditLog.findMany({
        where: { userId: { in: mismatchedAccounts.map((a) => a.userId) } },
        take: 15,
        orderBy: { createdAt: "desc" },
      });
    }

    const aiAnalysis = await AIReconciliationAnalyzer.analyzeMismatches(
      mismatchedAccounts,
      wallets.length,
      logsSample,
    );

    return {
      success: true,
      totalWalletsChecked: wallets.length,
      mismatchCount: mismatchedAccounts.length,
      mismatchedAccounts,
      durationMs: duration,
      aiAnalysis,
    };
  }
}
