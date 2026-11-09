import cron from "node-cron";
import prisma from "../database/prismaClient";

export const initAnalyticsCron = () => {
  // Cứ mỗi 10 phút, làm mới View 1 lần
  cron.schedule("*/10 * * * *", async () => {
    try {
      await prisma.$executeRawUnsafe(
        `REFRESH MATERIALIZED VIEW revenue_stats;`,
      );
      console.log("[CRON] Đã làm mới bảng thống kê doanh thu.");
    } catch (error) {
      console.error("[CRON ANALYTICS] Lỗi:", error);
    }
  });
};
