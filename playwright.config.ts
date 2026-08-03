import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  globalSetup: "./test/e2e/global-setup.mjs",
  reporter: [["line"]],
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:8081",
    trace: "off",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
    launchOptions: {
      args: ["--host-resolver-rules=MAP localhost 127.0.0.1"],
    },
  },
});
