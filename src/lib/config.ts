import { prisma } from "./db";

export interface AppConfig {
  pricing: string; // runtime pricing text; empty = don't mention price
  weights: { pain: number; timing: number; stageFit: number; budget: number; reachability: number; geography: number };
  thresholds: { pursue: number; maybeLater: number }; // weighted-score cutoffs
  subreddits: string[];
  redditLimitPerSub: number;
  ycBatches: string[];
  ycMaxPerRun: number;
  hnMaxPerRun: number;
  edgarMaxPerRun: number;
  scoreBatchSize: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  pricing: "",
  weights: { pain: 0.3, timing: 0.25, stageFit: 0.15, budget: 0.15, reachability: 0.1, geography: 0.05 },
  thresholds: { pursue: 3.5, maybeLater: 2.5 },
  subreddits: ["startups", "Entrepreneur", "SaaS", "EntrepreneurRideAlong"],
  redditLimitPerSub: 50,
  ycBatches: ["Spring 2026", "Winter 2026"],
  ycMaxPerRun: 25,
  hnMaxPerRun: 25,
  edgarMaxPerRun: 15,
  scoreBatchSize: 10,
};

export function mergeConfig(rows: { key: string; value: string }[]): AppConfig {
  const cfg: AppConfig = structuredClone(DEFAULT_CONFIG);
  for (const row of rows) {
    if (row.key in cfg) {
      try {
        (cfg as unknown as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        /* keep default on bad JSON */
      }
    }
  }
  return cfg;
}

export async function getConfig(): Promise<AppConfig> {
  return mergeConfig(await prisma.config.findMany());
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    const v = JSON.stringify(value);
    await prisma.config.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
}
