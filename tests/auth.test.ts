import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import app from "../app";
import prisma from "../database/prismaClient";
import {
  teardownTestEnvironment,
  cleanupTestData,
  TEST_PREFIX,
} from "./utils/dbTestHelper";

describe("Kiểm thử API Xác thực", () => {
  const testEmail = `${TEST_PREFIX}auth_${Date.now()}@nexusticket.com`;
  const testPassword = "Password123!";

  beforeAll(async () => {
    await prisma.users.create({
      data: {
        email: testEmail,
        password: "$2a$10$....", // (Hãy dùng bcrypt.hash để tạo pass thật trong beforeAll nếu test login success)
        fullName: "Auth Test",
        role: "CUSTOMER",
      },
    });
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
    await teardownTestEnvironment();
  });

  it("Phải trả về 400 khi đăng nhập sai mật khẩu", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "WrongPassword" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Email hoặc mật khẩu không chính xác!");
  });
});
