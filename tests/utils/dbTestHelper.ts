import prisma from "../../database/prismaClient";
import { redisPrimary, redisBackup } from "../../Utils/redisLock";
import { mailQueue } from "../../queues/mailQueue";

export const TEST_PREFIX = "test_jest_";

export async function cleanupTestData() {
  try {
    const testUsers = await prisma.users.findMany({
      where: { email: { startsWith: TEST_PREFIX } },
      select: { id: true },
    });

    const testUserIds = testUsers.map((u) => u.id);

    if (testUserIds.length > 0) {
      const idsString = testUserIds.join(",");
      await prisma.$executeRawUnsafe(
        `DELETE FROM "AuditLog" WHERE "userId" IN (${idsString})`,
      );
      await prisma.tickets.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.wallets.deleteMany({
        where: { userId: { in: testUserIds } },
      });
      await prisma.users.deleteMany({ where: { id: { in: testUserIds } } });
    }
    await prisma.trips.deleteMany({
      where: { route: { startsWith: "TEST_ROUTE_" } },
    });
  } catch (error) {
    console.error("❌ Lỗi dọn dẹp DB Test:", error);
  }
}

export async function teardownTestEnvironment() {
  try {
    await prisma.$disconnect();
    if (mailQueue) await mailQueue.close();
    if (redisPrimary && redisPrimary.status !== "end")
      redisPrimary.disconnect();
    if (redisBackup && redisBackup.status !== "end") redisBackup.disconnect();
  } catch (error) {
    console.error("❌ Lỗi teardown:", error);
  }
}
