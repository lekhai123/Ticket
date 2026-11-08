import { BookingService } from "../Service/bookingService";
import prisma from "../database/prismaClient";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";

describe("Kiểm thử Đặt vé & Kiểm soát đồng thời (Overselling)", () => {
  let testUserId: number;
  let testTripId: number;
  const testSeat = 99;

  beforeAll(async () => {
    // 1. Tạo User test
    const user = await prisma.users.create({
      data: {
        email: "test_booking_jest@nexusticket.com",
        password: "hashed_password_123",
        fullName: "Test User Booking",
        wallet: { create: { balance: 0 } },
      },
    });
    testUserId = user.id;

    // 2. Tạo Chuyến xe test
    const trip = await prisma.trips.create({
      data: {
        route: "Test Route - Jest",
        departureAt: new Date(Date.now() + 86400000), // Ngày mai
        price: 100000,
        totalSeats: 100,
      },
    });
    testTripId = trip.id;
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    await prisma.tickets.deleteMany({ where: { tripId: testTripId } });
    await prisma.trips.delete({ where: { id: testTripId } });
    await prisma.wallets.deleteMany({ where: { userId: testUserId } });
    await prisma.users.delete({ where: { id: testUserId } });
  });

  it("Phải văng lỗi 409 khi 2 người cùng đặt 1 ghế trong cùng 1 giây", async () => {
    // Giả lập 2 request gọi đồng thời bằng Promise.all
    const book1 = BookingService.holdOrBookSeat(
      testUserId,
      testTripId,
      testSeat,
      "LATER",
    );
    const book2 = BookingService.holdOrBookSeat(
      testUserId,
      testTripId,
      testSeat,
      "LATER",
    );

    const results = await Promise.allSettled([book1, book2]);

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    // Nếu có lỗi, in ra console để dễ debug
    if (successCount !== 1) {
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          console.log(`❌ Request ${i + 1} bị lỗi:`, res.reason);
        }
      });
    }

    expect(successCount).toBe(1);
    expect(failedCount).toBe(1);

    if (failedCount === 1) {
      const err = (
        results.find((r) => r.status === "rejected") as PromiseRejectedResult
      ).reason;
      // Kỳ vọng lỗi trả về là 409 Conflict (Ghế đang bị giữ)
      expect(err.statusCode).toBe(409);
    }
  });
});
