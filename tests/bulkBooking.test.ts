import { BookingService } from "../Service/bookingService";
import prisma from "../database/prismaClient";
import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import {
  cleanupTestData,
  TEST_PREFIX,
  teardownTestEnvironment,
} from "./utils/dbTestHelper";

jest.setTimeout(60000); // Tăng timeout vì khóa từng ghế tốn thời gian hơn

jest.mock("../queues/mailQueue", () => ({
  sendNotificationEmail: jest.fn<any>(() => Promise.resolve({ success: true })),
  scheduleNotificationWithReset: jest.fn<any>(() => Promise.resolve(true)),
}));

describe("Kiểm thử Đặt nhiều ghế cùng lúc (Bulk Booking)", () => {
  let testUserId: number;
  let testTripId: number;
  const testEmail = `${TEST_PREFIX}bulk_${Date.now()}@nexusticket.com`;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: testEmail,
        password: "hashed",
        fullName: "Bulk User",
        wallet: { create: { balance: 500000 } },
      },
    });
    testUserId = user.id;

    const trip = await prisma.trips.create({
      data: {
        route: `TEST_ROUTE_BULK_${Date.now()}`,
        departureAt: new Date(Date.now() + 86400000),
        price: 100000,
        totalSeats: 50,
      },
    });
    testTripId = trip.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await teardownTestEnvironment();
  });

  it("Phải đặt thành công 3 ghế và trừ đúng số tiền", async () => {
    const seats = [1, 2, 3];
    const batchId = `TEST_BATCH_${Date.now()}`;

    // Xóa tham số "WALLET" ở đây (hàm giờ chỉ nhận 4 tham số)
    const tickets = await BookingService.bookMultipleSeats(
      testUserId,
      testTripId,
      seats,
      batchId,
    );

    expect(tickets.length).toBe(3);

    const wallet = await prisma.wallets.findUnique({
      where: { userId: testUserId },
    });
    expect(Number(wallet?.balance)).toBe(200000); // 500k - 300k
  });
});
