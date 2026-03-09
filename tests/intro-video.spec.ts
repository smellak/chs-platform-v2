import { test, expect } from "@playwright/test";

const BASE = process.env["TEST_BASE_URL"] ?? "https://platform.centrohogarsanchez.es";

test.describe("Intro Video", () => {
  test.beforeEach(async ({ context }) => {
    // Clear the intro cookie so video plays fresh each test
    await context.clearCookies();
  });

  test("T01: intro video overlay visible on first visit", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const overlay = page.locator('[data-testid="intro-video-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10000 });
  });

  test("T02: skip button visible", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const skipBtn = page.locator('[data-testid="button-skip-intro"]');
    await expect(skipBtn).toBeVisible({ timeout: 10000 });
    await expect(skipBtn).toContainText("Saltar intro");
  });

  test("T03: clicking skip hides overlay and shows login form", async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const overlay = page.locator('[data-testid="intro-video-overlay"]');
    await expect(overlay).toBeVisible({ timeout: 10000 });

    // Click the skip button
    const skipBtn = page.locator('[data-testid="button-skip-intro"]');
    await skipBtn.click();

    // Wait for fade-out transition (1.4s) + unmount
    await expect(overlay).not.toBeVisible({ timeout: 5000 });

    // Login form should now be visible
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("T04: cookie is set after skip", async ({ page, context }) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const skipBtn = page.locator('[data-testid="button-skip-intro"]');
    await expect(skipBtn).toBeVisible({ timeout: 10000 });
    await skipBtn.click();

    // Wait for the skip to complete
    await page.waitForTimeout(2000);

    // Check the cookie is set
    const cookies = await context.cookies();
    const introCookie = cookies.find((c) => c.name === "chs_intro_seen");
    expect(introCookie).toBeDefined();
    expect(introCookie!.value).toBe("1");
  });

  test("T05: second visit skips video and shows login directly", async ({ page, context }) => {
    // Set the cookie manually to simulate a return visit
    await context.addCookies([
      {
        name: "chs_intro_seen",
        value: "1",
        domain: new URL(BASE).hostname,
        path: "/",
      },
    ]);

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

    // Video overlay should NOT be visible
    const overlay = page.locator('[data-testid="intro-video-overlay"]');
    await expect(overlay).not.toBeVisible({ timeout: 3000 });

    // Login form should be visible immediately
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 5000 });
  });
});
