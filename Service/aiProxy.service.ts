// src/services/aiProxy.service.ts
import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface AIProvider {
  name: string;
  apiKey: string;
  modelName: string;
}

export class AIProxyService {
  // Cấu hình danh sách Key ưu tiên: Primary trước, Secondary dự phòng
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
   * 1. Sinh văn bản / Chat có cơ chế tự động Failover
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

  /**
   * 2. Tạo Vector Embedding có tự động xoay vòng Primary -> Secondary
   */
  static async getEmbeddingWithFallback(text: string): Promise<number[]> {
    const textInput = String(text).trim();
    if (!textInput) {
      throw new Error("Text input for embedding cannot be empty");
    }

    let lastError: any = null;

    for (const provider of this.providers) {
      if (!provider.apiKey) continue;

      try {
        console.log(
          `🤖 [AI Proxy Embedding] Đang tạo Vector qua: ${provider.name}...`,
        );
        const ai = new GoogleGenAI({ apiKey: provider.apiKey });

        const response = await ai.models.embedContent({
          model: "gemini-embedding-2", // hoặc text-embedding-004
          contents: [
            {
              role: "user",
              parts: [{ text: textInput }],
            },
          ],
          config: {
            outputDimensionality: 1536,
          },
        });

        const embeddingValues = response.embeddings?.[0]?.values ?? [];
        if (embeddingValues.length > 0) {
          return embeddingValues;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(
          `⚠️ [AI Proxy Embedding] ${provider.name} gặp sự cố (${error.message}). Đang chuyển sang ${provider.name === "Gemini-Primary" ? "GEMINI_SECONDARY_KEY" : "kết thúc"}...`,
        );
      }
    }

    throw new Error(
      `❌ [AI Proxy Critical] Không thể tạo Embedding từ cả Primary lẫn Secondary Key! Error: ${lastError?.message}`,
    );
  }
}
