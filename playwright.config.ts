import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  // PW_CHANNEL=chrome (or msedge) runs against an installed browser instead of Playwright's downloaded builds.
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) }, grepInvert: /@mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"], ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}) }, grep: /@mobile/ },
  ],
  webServer: { command: "npm run dev", port, reuseExistingServer: true, timeout: 180_000 },
});
