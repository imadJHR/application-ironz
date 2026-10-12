import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
const localBrowser = join(
  homedir(),
  "AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
            (existsSync(localBrowser) ? localBrowser : undefined),
        },
      },
    },
  ],
});
