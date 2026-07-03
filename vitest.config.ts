import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    passWithNoTests: true,
    globalSetup: "./vitest.globalSetup.ts",
    env: { DATABASE_URL: "file:./test.db" },
  },
});
