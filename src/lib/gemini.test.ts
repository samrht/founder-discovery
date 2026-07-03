import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateJson } from "./gemini";

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
