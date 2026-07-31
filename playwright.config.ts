import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "e2e.spec.ts",
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.012,
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4188/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "PATH=/Users/patransd/.nvm/versions/node/v22.22.2/bin:$PATH npm run dev",
    url: "http://127.0.0.1:4188/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  outputDir: "test-results",
  reporter: [["list"]],
});
