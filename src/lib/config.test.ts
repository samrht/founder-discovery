import { describe, it, expect } from "vitest";
import { DEFAULT_CONFIG, mergeConfig } from "./config";

describe("mergeConfig", () => {
  it("returns defaults when no rows", () => {
    expect(mergeConfig([])).toEqual(DEFAULT_CONFIG);
  });
  it("overrides defaults with stored rows", () => {
    const cfg = mergeConfig([{ key: "pricing", value: JSON.stringify("Reports start at $299") }]);
    expect(cfg.pricing).toBe("Reports start at $299");
    expect(cfg.weights).toEqual(DEFAULT_CONFIG.weights);
  });
  it("ignores unknown keys", () => {
    expect(mergeConfig([{ key: "bogus", value: "1" }])).toEqual(DEFAULT_CONFIG);
  });
});
