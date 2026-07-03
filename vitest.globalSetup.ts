import { execSync } from "child_process";

// Tests run against an isolated throwaway database (prisma/test.db), never dev.db —
// suites reset tables between cases, which must not touch real collected leads.
export default function setup() {
  execSync("npx prisma db push --skip-generate", {
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "ignore",
  });
}
