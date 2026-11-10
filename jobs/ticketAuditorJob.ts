import cron from "node-cron";
import prisma from "../database/prismaClient";
import { AIProxyService } from "../Service/aiProxy.service";

let isRunning = false;

export const initTicketAuditorCron = () => {
  cron.schedule("*/15 * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
    console.log("[AUDITOR CRON] Bắt đầu quét vé bất thường tự động...");

    try {
      // 1. Tìm các vé lỗi (giới hạn 10 vé để tránh quá tải)
      const anomalies = await prisma.$queryRaw`
        SELECT t.id, t."userId", t."tripId", t."paidAmount", tr.price AS "expectedPrice", tr.route
        FROM "Tickets" t
        JOIN "Trips" tr ON t."tripId" = tr.id
        WHERE t.status = 'CONFIRMED' 
          AND (t."paidAmount" IS NULL OR t."paidAmount" < tr.price OR t."paidAmount" = 0)
        ORDER BY t."createdAt" DESC
        LIMIT 10;
      `;

      if (!anomalies || (anomalies as any[]).length === 0) {
        isRunning = false;
        return;
      }

      console.log(
        `[AUDITOR CRON] Phát hiện ${(anomalies as any[]).length} vé lỗi. Đang nhờ AI phân tích...`,
      );

      let aiAnalysis =
        "Hệ thống AI đang quá tải, không thể phân tích lúc này. Vui lòng kiểm tra thủ công.";

      // 2. Gọi AI phân tích (Bọc trong try/catch riêng và có Timeout 15s)
      try {
        const prompt = `Bạn là chuyên gia tài chính. Hãy phân tích danh sách các vé bị lỗi giá sau đây và dự đoán nguyên nhân (VD: Lỗi nhập giá 0đ, bug code, hay vé tặng?): ${JSON.stringify(anomalies)}. Trả lời ngắn gọn trong 1 đoạn văn.`;

        const aiPromise = AIProxyService.generateWithFallback(prompt);
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout AI sau 15s")), 15000),
        );

        aiAnalysis = await Promise.race([aiPromise, timeoutPromise]);
      } catch (aiError: any) {
        console.error("[AUDITOR CRON] Lỗi phân tích AI:", aiError.message);
        // Vẫn giữ lại giá trị mặc định của biến aiAnalysis nếu AI sập
      }

      // 3. Lưu thông báo vào AuditLog (LUÔN LƯU, kể cả khi AI lỗi)
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

      console.log("[AUDITOR CRON] Đã lưu báo cáo cảnh báo lên hệ thống.");
    } catch (error: any) {
      console.error("[AUDITOR CRON] Lỗi quét DB:", error.message);
    } finally {
      isRunning = false;
    }
  });
};
