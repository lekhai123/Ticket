import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const models = await ai.models.list();

for (const model of models.page) {
  console.log(model.name);
}
