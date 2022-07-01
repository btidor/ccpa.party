import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

const config: PlaywrightTestConfig = {
  forbidOnly: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // TODO: re-add once playwright supports firefox 102
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  retries: process.env.CI ? 2 : 0,
  testDir: "playwright",
  use: {
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
