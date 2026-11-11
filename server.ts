import app from "./app";
import { ENV, isVercel } from "./config/env";
import prisma from "./database/prismaClient";
import { redisPrimary } from "./Utils/redisLock";
import { mailWorker } from "./queues/mailWorker"; // ✅ SỬA: Import Worker thật

// Hàm khởi động các tác vụ chạy ngầm (Chỉ chạy ở Local/VPS)
async function startBackgroundJobs() {
  if (isVercel) {
    console.log("Môi trường Vercel Serverless: Bỏ qua Worker và Cron Job.");
    return;
  }

  console.log("Môi trường Local/VPS: Đang khởi động Worker và Cron Job...");

  const { initReconciliationCron } = await import("./jobs/reconciliationJob");
  const { initAnalyticsCron } = await import("./jobs/analyticsJob");
  const { initTicketAuditorCron } = await import("./jobs/ticketAuditorJob");

  initReconciliationCron();
  initAnalyticsCron();
  initTicketAuditorCron();

  console.log("Mail Worker và 3 Cron Jobs đã khởi động cùng Server!");
}

// Khởi chạy Server
async function bootstrap() {
  await startBackgroundJobs();

  if (!isVercel) {
    const PORT = ENV.PORT;
    const server = app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });

    // Thêm Graceful Shutdown (Bắt tín hiệu tắt máy để đóng kết nối an toàn)
    const shutdown = async () => {
      console.log("Đang tắt server an toàn...");
      server.close(async () => {
        await prisma.$disconnect();
        await redisPrimary.quit();
        await mailWorker.close();
        console.log("Đã đóng tất cả kết nối!");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

// Chạy bootstrap và bắt lỗi nếu có
bootstrap().catch((error) => {
  console.error("Lỗi khởi động server:", error);
  process.exit(1);
});

// BẮT BUỘC: Export app cho Vercel Serverless Function
export default app;
