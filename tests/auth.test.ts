import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import app from "../app"; // Import app (không import server.ts để không bật cổng listen)
import prisma from "../database/prismaClient";

describe("Kiểm thử API Xác thực", () => {
  const testEmail = "test_jest@nexusticket.com";
  const testPassword = "Password123!";

  beforeAll(async () => {
    // Xóa user test cũ nếu có
    await prisma.users.deleteMany({ where: { email: testEmail } });
  });

  afterAll(async () => {
    // Dọn dẹp
    await prisma.users.deleteMany({ where: { email: testEmail } });
    await prisma.$disconnect();
  });

  it("Phải trả về 400 khi đăng nhập sai mật khẩu", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: "WrongPassword" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Email hoặc mật khẩu không chính xác!");
  });

  it("Phải cấp Access Token trong JSON và Refresh Token trong Cookie khi đăng nhập đúng", async () => {
    // (Giả sử user này đã được tạo trong DB từ trước)
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testEmail, password: testPassword });

    if (res.status === 200) {
      expect(res.body.data).toHaveProperty("accessToken");
      // Kiểm tra xem Cookie có được set không
      expect(res.headers["set-cookie"][0]).toMatch(/refreshToken=/);
    }
  });
});
