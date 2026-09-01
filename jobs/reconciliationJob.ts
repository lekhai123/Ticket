// jobs/reconciliationJob.ts
import cron from "node-cron";
import { ReconciliationService } from "../Service/reconciliationService";

export const initReconciliationCron = () => {
  // Lịch chạy: Đúng 03:00:00 AM hàng ngày (0 3 * * *)
  cron.schedule("0 3 * * *", async () => {
    try {
      await ReconciliationService.runDailyReconciliation();
    } catch (error) {
      console.error("❌ Lỗi khi chạy Cron Job đối soát 3h sáng:", error);
    }
  });

  console.log("⏰ đã đăng ký Cron Job đối soát tài chính (Chạy lúc 03:00 AM)");
};
