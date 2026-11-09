import cron from "node-cron";
import prisma from "../database/prismaClient";
import { AIProxyService } from "../Service/aiProxy.service";

let isRunning = false;

export const initTicketAuditorCron = () => {
  // Chạy tự động mỗi 15 phút một lần
  cron.schedule("*/15 * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    console.log("[AUDITOR CRON] Bắt đầu quét vé bất thường tự động...");

    try {
      // 1. Tìm các vé lỗi trong 15 phút qua
      const anomalies = await prisma.$queryRaw`
        SELECT t.id, t."userId", t."tripId", t."paidAmount", tr.price AS "expectedPrice", tr.route
        FROM "Tickets" t
        JOIN "Trips" tr ON t."tripId" = tr.id
        WHERE t.status = 'CONFIRMED' 
          AND (t."paidAmount" IS NULL OR t."paidAmount" < tr.price OR t."paidAmount" = 0)
        ORDER BY t."createdAt" DESC
        LIMIT 20;
      `;

      if (!anomalies || (anomalies as any[]).length === 0) {
        isRunning = false;
        return;
      }

      console.log(
        `[AUDITOR CRON] Phát hiện ${(anomalies as any[]).length} vé lỗi. Đang nhờ AI phân tích...`,
      );

      // 2. Gọi AI phân tích
      const prompt = `Bạn là chuyên gia tài chính. Hãy phân tích danh sách các vé bị lỗi giá sau đây và dự đoán nguyên nhân (VD: Lỗi nhập giá 0đ, bug code, hay vé tặng?): ${JSON.stringify(anomalies)}. Trả lời ngắn gọn trong 1 đoạn văn.`;
      const aiAnalysis = await AIProxyService.generateWithFallback(prompt);

      // 3. Lưu thông báo vào AuditLog để Admin xem
      await prisma.auditLog.create({
        data: {
          requestId: `AUDITOR_AI_${Date.now()}`,
          action: "AI_ANOMALY_ALERT",
          resource: "System",
          resourceId: "TICKET_AUDIT",
          newData: {
            message: `Phát hiện ${(anomalies as any[]).length} vé bất thường!`,
            aiAnalysis: aiAnalysis,
            anomalies: anomalies,
          },
        },
      });

      console.log("[AUDITOR CRON] Đã lưu báo cáo AI lên hệ thống.");
    } catch (error: any) {
      console.error("[AUDITOR CRON] Lỗi:", error.message);
    } finally {
      isRunning = false;
    }
  });
};
