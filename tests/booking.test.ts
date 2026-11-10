import { BookingService } from "../Service/bookingService";
import prisma from "../database/prismaClient";
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
describe("Kiểm thử Đặt vé (DB thật)", () => {
  let testUserId: number;
  let testTripId: number;
  const testEmail = `${TEST_PREFIX}booking_${Date.now()}@nexusticket.com`;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: testEmail,
        password: "hashed_password",
        fullName: "Test Booking",
        wallet: { create: { balance: 500000 } },
      },
    });
    testUserId = user.id;

    const trip = await prisma.trips.create({
      data: {
        route: `TEST_ROUTE_${Date.now()}`,
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

  it("Phải đặt vé thành công và trừ tiền ví chính xác", async () => {
    const ticket = await BookingService.holdOrBookSeat(
      testUserId,
      testTripId,
      1,
      "WALLET",
      `BATCH_${Date.now()}`,
    );

    expect(ticket).toBeDefined();
    expect(ticket.status).toBe("CONFIRMED");

    const wallet = await prisma.wallets.findUnique({
      where: { userId: testUserId },
    });

    expect(wallet).not.toBeNull();
    expect(Number(wallet?.balance)).toBe(400000);
  });
});
