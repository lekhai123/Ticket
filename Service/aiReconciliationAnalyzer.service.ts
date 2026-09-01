// src/services/aiReconciliationAnalyzer.service.ts
import { AIProxyService } from "./aiProxy.service";
import type { MismatchDetail } from "../Service/reconciliationService";

export class AIReconciliationAnalyzer {
  /**
   * Đưa dữ liệu đối soát cho Gemini phân tích nguyên nhân gốc & hành vi bất thường
   */
  static async analyzeMismatches(
    mismatchedAccounts: MismatchDetail[],
    totalWallets: number,
    auditLogsSample: any[],
  ) {
    if (mismatchedAccounts.length === 0) {
      return {
        summary:
          "Hệ thống tài chính đạt độ an toàn 100%, không phát hiện bất thường.",
        riskLevel: "LOW",
      };
    }

    const prompt = `
[BÁO CÁO ĐỐI SOÁT TÀI CHÍNH CẦN PHÂN TÍCH AIOPS]
Bạn là Chuyên gia Kiểm toán CNTT & An ninh Tài chính (AIOps Security Auditor).
Hãy phân tích dữ liệu đối soát dưới đây và trả về kết quả dưới dạng JSON duy nhất.

- Tổng số ví kiểm tra: ${totalWallets}
- Số ví bị chênh lệch số dư: ${mismatchedAccounts.length}
- Danh sách chênh lệch: ${JSON.stringify(mismatchedAccounts, null, 2)}
- Mẫu AuditLog liên quan: ${JSON.stringify(auditLogsSample, null, 2)}

YÊU CẦU ĐẦU RA (Chỉ trả về JSON thuần, không kèm Markdown wrapper \`\`\`json):
{
  "riskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "rootCauseAnalysis": "Đánh giá chi tiết nguyên nhân gốc gây ra sự chênh lệch (Ví dụ: do lỗi trùng log, thiếu log khởi tạo balance, hay có dấu hiệu sửa lén DB)",
  "recommendedAction": "Các bước hành động khuyến nghị cho Admin",
  "executiveSummary": "Tóm tắt ngắn gọn 2 câu cho Ban giám đốc"
}
`;

    try {
      const rawAiResponse = await AIProxyService.generateWithFallback(prompt);

      // Clean JSON string if wrapped in markdown
      const cleanedJson = rawAiResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleanedJson);
    } catch (error: any) {
      console.error("Lỗi phân tích AI Đối soát:", error);
      return {
        riskLevel: "HIGH",
        rootCauseAnalysis: "Không thể gọi AI phân tích do sự cố mạng/proxy.",
        recommendedAction:
          "Kiểm tra thủ công danh sách mảng mismatchedAccounts.",
        executiveSummary:
          "Phát hiện sai số tài chính nhưng AI Proxy không khả dụng.",
      };
    }
  }
}
