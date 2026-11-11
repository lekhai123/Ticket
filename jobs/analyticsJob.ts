import cron from "node-cron";
import prisma from "../database/prismaClient";

export const initAnalyticsCron = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      // Thêm CONCURRENTLY để không khóa bảng
      await prisma.$executeRawUnsafe(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_stats;`,
      );
      console.log("[CRON] Đã làm mới bảng thống kê doanh thu.");
    } catch (error) {
      console.error("[CRON ANALYTICS] Lỗi:", error);
    }
  });
};
