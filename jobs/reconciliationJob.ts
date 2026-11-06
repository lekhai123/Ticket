import cron from "node-cron";
import { ReconciliationService } from "../Service/reconciliationService";

let isRunning = false;

export const initReconciliationCron = () => {
  // Lịch chạy: Đúng 03:00:00 AM hàng ngày (0 3 * * *)
  cron.schedule("0 3 * * *", async () => {
    if (isRunning) {
      console.warn(
        "[CRON RECONCILIATION] Job đang chạy từ trước, bỏ qua lượt này để tránh xung đột!",
      );
      return;
    }

    try {
      isRunning = true;
      console.log(
        "[CRON RECONCILIATION] Bắt đầu tiến trình đối soát tự động...",
      );
      const result = await ReconciliationService.runDailyReconciliation();
      console.log(
        `[CRON RECONCILIATION] Hoàn tất. Đã check ${result.totalWalletsChecked} ví, phát hiện ${result.mismatchCount} lỗi.`,
      );
    } catch (error) {
      console.error(
        "[CRON RECONCILIATION] Lỗi khi chạy Job đối soát 3h sáng:",
        error,
      );
    } finally {
      isRunning = false;
    }
  });

  console.log("Đã đăng ký Cron Job đối soát tài chính (Chạy lúc 03:00 AM)");
};
