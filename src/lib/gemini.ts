import { GoogleGenAI } from "@google/genai";
import { ZodType } from "zod";

const sleepMs = process.env.NODE_ENV === "test" ? 0 : 2000;

async function defaultCall(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return res.text ?? "";
}

export async function generateJson<T>(
  prompt: string,
  schema: ZodType<T>,
  call: (prompt: string) => Promise<string> = defaultCall,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await call(prompt);
      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      return schema.parse(JSON.parse(cleaned));
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
  throw lastErr;
}
