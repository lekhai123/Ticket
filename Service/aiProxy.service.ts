// src/services/aiProxy.service.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

interface AIProvider {
  name: string;
  apiKey: string;
  modelName: string;
}

export class AIProxyService {
  // Danh sách các Key / Provider dự phòng theo thứ tự ưu tiên
  private static providers: AIProvider[] = [
    {
      name: "Gemini-Primary",
      apiKey: process.env.GEMINI_PRIMARY_KEY || "",
      modelName: "gemini-2.5-flash",
    },
    {
      name: "Gemini-Secondary",
      apiKey: process.env.GEMINI_SECONDARY_KEY || "",
      modelName: "gemini-2.5-flash",
    },
  ];

  /**
   * Gọi AI sinh phản hồi với cơ chế Tự động Failover sang Key dự phòng khi gặp lỗi
   */
  static async generateWithFallback(prompt: string): Promise<string> {
    let lastError: any = null;

    for (const provider of this.providers) {
      if (!provider.apiKey) continue;

      try {
        console.log(
          `🤖 [AI Proxy] Đang xử lý qua Provider: ${provider.name}...`,
        );

        const genAI = new GoogleGenerativeAI(provider.apiKey);
        const model = genAI.getGenerativeModel({ model: provider.modelName });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        if (responseText) {
          return responseText;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(
          `⚠️ [AI Proxy] Provider ${provider.name} thất bại (${error.message}). Đang tự động chuyển sang Provider dự phòng...`,
        );
      }
    }

    throw new Error(
      `❌ [AI Proxy Critical] Tất cả các AI Provider/Key dự phòng đều sập! Error: ${lastError?.message}`,
    );
  }
}
