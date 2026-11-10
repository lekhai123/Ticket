import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./",
  timeout: 60000, // Chờ tối đa 60s cho mỗi test
  fullyParallel: true,
  retries: 1, // Nếu lỗi, thử lại 1 lần
  use: {
    baseURL: "https://ticket-lekhai.vercel.app/", // URL Frontend của bạn
    trace: "on-first-retry",
    video: "on", // Tự động quay video
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
