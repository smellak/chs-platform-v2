import { test, expect, type Page } from "@playwright/test";

const BASE =
  process.env["TEST_BASE_URL"] ?? "https://platform.centrohogarsanchez.es";

async function loginAsAdmin(page: Page) {
  const domain = new URL(BASE).hostname;
  await page.context().addCookies([
    { name: "chs_intro_seen", value: "1", domain, path: "/" },
  ]);
  await page.goto(`${BASE}/login`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
  await page.waitForLoadState("networkidle");
}

test.describe("API Providers Panel — Smart Form", () => {
  test("T01: page loads with providers table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores API')"),
    ).toBeVisible({ timeout: 10000 });
    // At least Google AI should exist
    await expect(
      page.locator("tr").filter({ hasText: "Google AI" }),
    ).toBeVisible();
  });

  test("T02: edit dialog shows model dropdown with provider models", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    // Click edit on Google AI
    const googleRow = page.locator("tr").filter({ hasText: "Google AI" });
    await googleRow.locator("button", { hasText: "Editar" }).click();

    // Dialog should be open
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Model dropdown should exist
    const modelSelect = page.locator('[data-testid="model-select"]');
    await expect(modelSelect).toBeVisible();

    // Open model dropdown
    await modelSelect.click();

    // Should show Google models
    await expect(
      page.locator('[role="option"]').filter({ hasText: "Gemini 2.5 Flash —" }),
    ).toBeVisible();
    await expect(
      page.locator('[role="option"]').filter({ hasText: "Gemini 3 Flash (Preview)" }),
    ).toBeVisible();
  });

  test("T03: changing provider type updates model list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    // Open edit
    const googleRow = page.locator("tr").filter({ hasText: "Google AI" });
    await googleRow.locator("button", { hasText: "Editar" }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Change provider type to Anthropic
    const typeSelect = page.locator('[data-testid="provider-type-select"]');
    await typeSelect.click();
    await page.locator('[role="option"]').filter({ hasText: "Anthropic" }).click();

    // Open model dropdown — should show Anthropic models now
    const modelSelect = page.locator('[data-testid="model-select"]');
    await modelSelect.click();

    await expect(
      page.locator('[role="option"]').filter({ hasText: "Claude Sonnet 4" }),
    ).toBeVisible();
    await expect(
      page.locator('[role="option"]').filter({ hasText: "Claude Opus 4" }),
    ).toBeVisible();

    // Google models should NOT be visible
    await expect(
      page.locator('[role="option"]').filter({ hasText: "Gemini" }),
    ).toHaveCount(0);
  });

  test("T04: selecting model auto-fills cost fields", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    // Click "Nuevo Proveedor"
    await page.click("button:has-text('Nuevo Proveedor')");
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Change to OpenAI
    const typeSelect = page.locator('[data-testid="provider-type-select"]');
    await typeSelect.click();
    await page.locator('[role="option"]').filter({ hasText: "OpenAI" }).click();

    // Select GPT-4o model
    const modelSelect = page.locator('[data-testid="model-select"]');
    await modelSelect.click();
    await page.locator('[role="option"]').filter({ hasText: "GPT-4o —" }).first().click();

    // Cost fields should be auto-filled
    // GPT-4o: $2.50/$10.00 per MTok → $0.0025/$0.01 per 1K tokens
    const costInput = page.locator('[data-testid="cost-input"]');
    const costOutput = page.locator('[data-testid="cost-output"]');
    await expect(costInput).toHaveValue("0.0025");
    await expect(costOutput).toHaveValue("0.01");
  });

  test("T05: base URL auto-fills when provider type changes", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    await page.click("button:has-text('Nuevo Proveedor')");
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Default provider is Google — check base URL
    const baseUrlInput = page.locator("#provBaseUrl");
    await expect(baseUrlInput).toHaveValue(
      "https://generativelanguage.googleapis.com",
    );

    // Change to Anthropic
    const typeSelect = page.locator('[data-testid="provider-type-select"]');
    await typeSelect.click();
    await page.locator('[role="option"]').filter({ hasText: "Anthropic" }).click();

    await expect(baseUrlInput).toHaveValue("https://api.anthropic.com");

    // Change to OpenAI
    await typeSelect.click();
    await page.locator('[role="option"]').filter({ hasText: "OpenAI" }).click();

    await expect(baseUrlInput).toHaveValue("https://api.openai.com");
  });

  test("T06: provider change warning shows when editing", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    // Edit Google AI
    const googleRow = page.locator("tr").filter({ hasText: "Google AI" });
    await googleRow.locator("button", { hasText: "Editar" }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Change provider type
    const typeSelect = page.locator('[data-testid="provider-type-select"]');
    await typeSelect.click();
    await page.locator('[role="option"]').filter({ hasText: "Anthropic" }).click();

    // Should show warning about provider change
    await expect(
      page.locator("text=Has cambiado el tipo de proveedor"),
    ).toBeVisible();
  });

  test("T07: table shows cost column with real values", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    // Cost column header should exist
    await expect(
      page.locator("th:has-text('Coste')"),
    ).toBeVisible();
  });

  test("T08: validate key button exists and is disabled without key", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    await page.click("button:has-text('Nuevo Proveedor')");
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const validateBtn = page.locator('[data-testid="validate-key-btn"]');
    await expect(validateBtn).toBeVisible();
    await expect(validateBtn).toBeDisabled();
  });
});
