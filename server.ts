import app from "./app";
import { ENV, isVercel } from "./config/env";

// Hàm khởi động các tác vụ chạy ngầm (Chỉ chạy ở Local/VPS)
async function startBackgroundJobs() {
  if (isVercel) {
    console.log("Môi trường Vercel Serverless: Bỏ qua Worker và Cron Job.");
    return;
  }

  console.log("Môi trường Local/VPS: Đang khởi động Worker và Cron Job...");

  // Dynamic Import để tránh lỗi treo kết nối Redis trên Vercel
  const { initReconciliationCron } = await import("./jobs/reconciliationJob");
  initReconciliationCron();

  await import("./queues/mailQueue");
  console.log("Mail Worker đã khởi động và đang chờ Job.");
}

// Khởi chạy Server
async function bootstrap() {
  await startBackgroundJobs();

  if (!isVercel) {
    const PORT = ENV.PORT;
    app.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  }
}

// Chạy bootstrap và bắt lỗi nếu có
bootstrap().catch((error) => {
  console.error("Lỗi khởi động server:", error);
  process.exit(1);
});

// BẮT BUỘC: Export app cho Vercel Serverless Function
export default app;
