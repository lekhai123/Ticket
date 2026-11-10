import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface AIProvider {
  name: string;
  apiKey: string;
  modelName: string;
}

export class AIProxyService {
  private static providers: AIProvider[] = [
    {
      name: "Gemini-Primary",
      apiKey: process.env.GEMINI_PRIMARY_KEY || "",
      modelName: "gemini-3.8-flash",
    },
    {
      name: "Gemini-Secondary",
      apiKey: process.env.GEMINI_SECONDARY_KEY || "",
      modelName: "gemini-3.8-flash",
    },
  ];

  static async generateWithFallback(prompt: string): Promise<string> {
    let lastError: any = null;

    for (const provider of this.providers) {
      if (!provider.apiKey) continue;

      try {
        console.log(`[AI Proxy] Đang xử lý qua Provider: ${provider.name}...`);
        const genAI = new GoogleGenerativeAI(provider.apiKey);
        const model = genAI.getGenerativeModel({ model: provider.modelName });

        // Tăng thời gian chờ lên 20 giây để AI kịp xử lý JSON dài
        const response = await Promise.race([
          model.generateContent(prompt),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout AI sau 20s")), 20000),
          ),
        ]);

        const responseText = response.response.text();

        if (responseText) {
          return responseText;
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
