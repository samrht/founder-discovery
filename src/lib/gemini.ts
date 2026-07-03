import { GoogleGenAI } from "@google/genai";
import { ZodType } from "zod";

const sleepMs = process.env.NODE_ENV === "test" ? 0 : 2000;

// Newest first: better scoring quality and the more generous free-tier limits.
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"];

export function modelChain(): string[] {
  const multi = (process.env.GEMINI_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (multi.length) return multi;
  const single = process.env.GEMINI_MODEL;
  if (single) return [single, ...DEFAULT_MODELS.filter((m) => m !== single)];
  return [...DEFAULT_MODELS];
}

// Lead triage doesn't need deep reasoning; minimal thinking cuts latency ~2-3x.
// gemini-3.x takes thinkingLevel, gemini-2.5 takes thinkingBudget, older models take neither.
export function thinkingConfigFor(model: string): Record<string, unknown> {
  if (/^gemini-3/.test(model)) return { thinkingConfig: { thinkingLevel: "minimal" } };
  if (/^gemini-2\.5/.test(model)) return { thinkingConfig: { thinkingBudget: 0 } };
  return {};
}

async function sdkCall(model: string, prompt: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", ...thinkingConfigFor(model) },
  });
  return res.text ?? "";
}

// Tries each model in the chain; quota (429), overload (5xx), or missing-model
// errors fall through to the next model so one exhausted quota never stops a run.
export async function callWithFallback(
  prompt: string,
  doCall: (model: string, prompt: string) => Promise<string> = sdkCall,
): Promise<string> {
  let lastErr: unknown;
  for (const model of modelChain()) {
    try {
      return await doCall(model, prompt);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function generateJson<T>(
  prompt: string,
  schema: ZodType<T>,
  call: (prompt: string) => Promise<string> = callWithFallback,
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
