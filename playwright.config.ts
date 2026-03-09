import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  /* Run tests sequentially to avoid triggering the login rate limiter.
     All tests share the same IP and the server rate-limits after 5 failed
     login attempts, so parallel workers cause cascading 429 failures. */
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || "https://platform.centrohogarsanchez.es",
    ignoreHTTPSErrors: true,
  },
  reporter: "list",
});
