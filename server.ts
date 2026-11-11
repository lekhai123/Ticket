import app from "./app";
import { ENV, isVercel } from "./config/env";
import prisma from "./database/prismaClient";
import { redisPrimary } from "./Utils/redisLock";
async function startBackgroundJobs() {
  if (isVercel) {
    console.log("Môi trường Vercel Serverless: Bỏ qua Worker và Cron Job.");
    return;
  }

  console.log("Môi trường Local/VPS: Đang khởi động Worker và Cron Job...");

  const { initReconciliationCron } = await import("./jobs/reconciliationJob");
  const { initAnalyticsCron } = await import("./jobs/analyticsJob");
  const { initTicketAuditorCron } = await import("./jobs/ticketAuditorJob");

  // Dynamic import mailWorker
  const { mailWorker } = await import("./queues/mailWorker");

  initReconciliationCron();
  initAnalyticsCron();
  initTicketAuditorCron();

  console.log("Mail Worker và 3 Cron Jobs đã khởi động cùng Server!");

  // Trả về mailWorker để hàm shutdown bên dưới sử dụng
  return { mailWorker };
}

async function bootstrap() {
  const backgroundServices = await startBackgroundJobs();

  if (!isVercel) {
    const PORT = ENV.PORT;
    const server = app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("Đang tắt server an toàn...");
      server.close(async () => {
        await prisma.$disconnect();
        await redisPrimary.quit();
        // Chỉ close mailWorker nếu nó đã được khởi tạo (không phải Vercel)
        if (backgroundServices?.mailWorker) {
          await backgroundServices.mailWorker.close();
        }
        console.log("Đã đóng tất cả kết nối!");
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

bootstrap().catch((error) => {
  console.error("Lỗi khởi động server:", error);
  process.exit(1);
});

export default app;
