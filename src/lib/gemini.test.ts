import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { generateJson, modelChain, callWithFallback } from "./gemini";

const schema = z.object({ ok: z.boolean() });

describe("generateJson", () => {
  it("parses valid JSON", async () => {
    expect(await generateJson("p", schema, async () => '{"ok":true}')).toEqual({ ok: true });
  });
  it("strips markdown fences", async () => {
    expect(await generateJson("p", schema, async () => '```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });
  it("retries once on invalid output then succeeds", async () => {
    const call = vi.fn().mockResolvedValueOnce("garbage").mockResolvedValueOnce('{"ok":false}');
    expect(await generateJson("p", schema, call)).toEqual({ ok: false });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("throws after two failures", async () => {
    await expect(generateJson("p", schema, async () => "nope")).rejects.toThrow();
  });
});

describe("modelChain", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses GEMINI_MODELS list when set", () => {
    vi.stubEnv("GEMINI_MODELS", "gemini-3.5-flash, gemini-2.5-flash");
    expect(modelChain()).toEqual(["gemini-3.5-flash", "gemini-2.5-flash"]);
  });
  it("puts single GEMINI_MODEL first, defaults after", () => {
    vi.stubEnv("GEMINI_MODELS", "");
    vi.stubEnv("GEMINI_MODEL", "gemini-2.5-flash");
    const chain = modelChain();
    expect(chain[0]).toBe("gemini-2.5-flash");
    expect(chain).toContain("gemini-3.5-flash");
    expect(new Set(chain).size).toBe(chain.length); // no duplicates
  });
  it("falls back to default chain with newest flash first", () => {
    vi.stubEnv("GEMINI_MODELS", "");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(modelChain()[0]).toBe("gemini-3.5-flash");
    expect(modelChain().length).toBeGreaterThan(1);
  });
});

describe("callWithFallback", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns first model's result when it works", async () => {
    vi.stubEnv("GEMINI_MODELS", "m1,m2");
    const doCall = vi.fn().mockResolvedValue("fine");
    expect(await callWithFallback("p", doCall)).toBe("fine");
    expect(doCall).toHaveBeenCalledTimes(1);
    expect(doCall).toHaveBeenCalledWith("m1", "p");
  });
  it("falls through to the next model on quota/API errors", async () => {
    vi.stubEnv("GEMINI_MODELS", "m1,m2,m3");
    const doCall = vi
      .fn()
      .mockRejectedValueOnce(new Error("429 RESOURCE_EXHAUSTED"))
      .mockRejectedValueOnce(new Error("503 overloaded"))
      .mockResolvedValueOnce("third time lucky");
    expect(await callWithFallback("p", doCall)).toBe("third time lucky");
    expect(doCall).toHaveBeenNthCalledWith(1, "m1", "p");
    expect(doCall).toHaveBeenNthCalledWith(2, "m2", "p");
    expect(doCall).toHaveBeenNthCalledWith(3, "m3", "p");
  });
  it("throws the last error when every model fails", async () => {
    vi.stubEnv("GEMINI_MODELS", "m1,m2");
    const doCall = vi.fn().mockRejectedValue(new Error("all down"));
    await expect(callWithFallback("p", doCall)).rejects.toThrow("all down");
    expect(doCall).toHaveBeenCalledTimes(2);
  });
});
