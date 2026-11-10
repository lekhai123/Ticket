import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import app from "../app";
import prisma from "../database/prismaClient";
import { AuthService } from "../Service/authService";
import {
  cleanupTestData,
  TEST_PREFIX,
  teardownTestEnvironment,
} from "./utils/dbTestHelper";

describe("Kiểm thử API Ví điện tử", () => {
  let testUserId: number;
  let adminToken: string;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: `${TEST_PREFIX}wallet_${Date.now()}@nexusticket.com`,
        password: "hashed",
        fullName: "Wallet Test",
        role: "CUSTOMER",
        wallet: { create: { balance: 0 } },
      },
    });
    testUserId = user.id;

    const admin = await prisma.users.create({
      data: {
        email: `${TEST_PREFIX}admin_${Date.now()}@nexusticket.com`,
        password: "hashed",
        fullName: "Admin Test",
        role: "ADMIN",
      },
    });
    adminToken = AuthService.generateTokensForUser(admin).accessToken;
  });

  afterAll(async () => {
    await cleanupTestData();
    await teardownTestEnvironment();
  });

  it("Phải nạp tiền thành công và cập nhật số dư", async () => {
    const res = await request(app)
      .post(`/api/wallets/${testUserId}/topup`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-idempotency-key", `test-key-${Date.now()}`)
      .send({ amount: 200000 });

    expect(res.status).toBe(200);

    const wallet = await prisma.wallets.findUnique({
      where: { userId: testUserId },
    });
    expect(Number(wallet?.balance)).toBe(200000);
  });
});
