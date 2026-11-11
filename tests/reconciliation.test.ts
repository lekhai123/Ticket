import { ReconciliationService } from "../Service/reconciliationService";
import prisma from "../database/prismaClient";
import { AuditSigner } from "../Utils/auditSigner";
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import {
  cleanupTestData,
  TEST_PREFIX,
  teardownTestEnvironment,
} from "./utils/dbTestHelper";

jest.mock("../queues/mailQueue", () => ({
  sendNotificationEmail: jest.fn<any>(() => Promise.resolve({ success: true })),
  scheduleNotificationWithReset: jest.fn<any>(() => Promise.resolve(true)),
}));
jest.mock("../Service/aiReconciliationAnalyzer.service", () => ({
  AIReconciliationAnalyzer: {
    analyzeMismatches: jest.fn().mockImplementation(() =>
      Promise.resolve({
        riskLevel: "HIGH",
        rootCauseAnalysis: "Mocked AI",
        recommendedAction: "Mocked Action",
      }),
    ),
  },
}));

jest.setTimeout(60000);

describe("Kiểm thử AIOps - Đối soát tài chính", () => {
  let hackerUserId: number;
  let hackerEmail: string;

  beforeAll(async () => {
    await cleanupTestData();
    hackerEmail = `${TEST_PREFIX}hacker_${Date.now()}@nexusticket.com`;

    const user = await prisma.users.create({
      data: {
        email: hackerEmail,
        password: "hashed",
        fullName: "Hacker Test",
        wallet: { create: { balance: 50000 } },
      },
    });
    hackerUserId = user.id;

    const wallet = await prisma.wallets.findUnique({
      where: { userId: hackerUserId },
    });

    // Tạo log hợp lệ
    await prisma.auditLog.create({
      data: {
        requestId: `TOPUP_${Date.now()}`,
        userId: hackerUserId,
        action: "TOP_UP",
        resource: "Wallets",
        resourceId: String(wallet?.id),
        newData: { amount: 50000, newBalance: 50000 },
      },
    });

    // Hacker can thiệp sửa số dư DB thành 9.999.999
    await prisma.wallets.update({
      where: { userId: hackerUserId },
      data: { balance: 9999999 },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await teardownTestEnvironment();
  });

  it("Phải phát hiện sai lệch, khóa ví và trừ tiền ảo", async () => {
    await ReconciliationService.runDailyReconciliation();
    const finalWallet = await prisma.wallets.findUnique({
      where: { userId: hackerUserId },
    });

    expect(finalWallet).not.toBeNull();
    expect(finalWallet?.isLocked).toBe(true);
    expect(Number(finalWallet?.balance)).toBe(50000);
  });
});
