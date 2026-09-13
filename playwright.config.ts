import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45000,
  use: {
    baseURL: process.env.GUARDIAO_E2E_ORIGIN || "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: "list",
  workers: 1,
});
