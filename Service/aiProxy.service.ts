import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import CircuitBreaker from "opossum";

interface AIProvider {
  name: string;
  apiKey: string;
  modelName: string;
}

export class AIProxyService {
  private static providers: AIProvider[] = [
    {
      name: "Gemini-Primary",
      apiKey: process.env.GEMINI_API_KEY || "",
      modelName: "gemini-3.6-flash",
    },
    {
      name: "Gemini-Secondary",
      apiKey: process.env.GEMINI_SECONDARY_KEY || "",
      modelName: "gemini-3.6-flash",
    },
  ];

  // lưu trữ các Circuit Breaker trong bộ nhớ để tái sử dụng
  private static breakers: Map<string, CircuitBreaker> = new Map();

  private static getBreaker(provider: AIProvider): CircuitBreaker {
    if (!this.breakers.has(provider.name)) {
      // Hàm gọi API thực tế (Action)
      const action = async (prompt: string) => {
        const genAI = new GoogleGenerativeAI(provider.apiKey);
        const model = genAI.getGenerativeModel({ model: provider.modelName });
        const response = await model.generateContent(prompt);
        return response.response.text();
      };

      // Khởi tạo Cầu dao (Circuit Breaker)
      const breaker = new CircuitBreaker(action, {
        timeout: 20000, // Thời gian chờ tối đa 1 request là 20s
        errorThresholdPercentage: 50, // Ngắt mạch nếu > 50% request bị lỗi
        volumeThreshold: 5, // Phải có ít nhất 5 request bị lỗi thì mới xét ngắt mạch
        resetTimeout: 60000, // Thử mở lại mạch sau 1 phút
      });

      // Khi mạch bị ngắt (Open), lập tức ném lỗi Fallback mà không gọi API
      breaker.fallback(() => {
        throw new Error(
          `[Circuit Open] ${provider.name} đang tạm ngưng do lỗi liên tục.`,
        );
      });

      // Log trạng thái để dễ debug
      breaker.on("open", () =>
        console.warn(`[Circuit Breaker] 🔴 MẠCH ĐÃ NGẮT cho ${provider.name}`),
      );
      breaker.on("halfOpen", () =>
        console.log(`[Circuit Breaker] 🟡 ĐANG THỬ LẠI cho ${provider.name}`),
      );
      breaker.on("close", () =>
        console.log(
          `[Circuit Breaker] 🟢 MẠCH ĐÃ ĐÓNG LẠI cho ${provider.name}`,
        ),
      );

      this.breakers.set(provider.name, breaker);
    }
    return this.breakers.get(provider.name)!;
  }

  static async generateWithFallback(prompt: string): Promise<string> {
    let lastError: any = null;

    for (const provider of this.providers) {
      if (!provider.apiKey) continue;

      try {
        console.log(`[AI Proxy] Đang xử lý qua Provider: ${provider.name}...`);
        const breaker = this.getBreaker(provider);

        // Bắn request qua Cầu dao (Cầu dao sẽ tự xử lý Timeout)
        const responseText = await breaker.fire(prompt);

        if (responseText) {
          return responseText as any;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(
          `[AI Proxy] Provider ${provider.name} thất bại (${error.message}). Đang tự động chuyển sang Provider dự phòng...`,
        );
      }
    }

    throw new Error(
      `[AI Proxy Critical] Tất cả các AI Provider/Key dự phòng đều sập! Error: ${lastError?.message}`,
    );
  }

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
          `[AI Proxy Embedding] Đang tạo Vector qua: ${provider.name}...`,
        );
        const ai = new GoogleGenAI({ apiKey: provider.apiKey });

        const response = await ai.models.embedContent({
          model: "gemini-embedding-2",
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
          `[AI Proxy Embedding] ${provider.name} gặp sự cố (${error.message}). Đang chuyển sang ${provider.name === "Gemini-Primary" ? "GEMINI_SECONDARY_KEY" : "kết thúc"}...`,
        );
      }
    }

    throw new Error(
      `[AI Proxy Critical] Không thể tạo Embedding từ cả Primary lẫn Secondary Key! Error: ${lastError?.message}`,
    );
  }
}
