import { test, expect, type Page } from "@playwright/test";

const BASE =
  process.env["TEST_BASE_URL"] ?? "https://platform.centrohogarsanchez.es";

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
  await page.waitForLoadState("networkidle");
}

test.describe("AI Governance — Providers & Models", () => {
  test("T01: Admin can view providers page with provider type column", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="api-providers-page"]')).toBeVisible({ timeout: 10000 });
    // Should show provider type column
    await expect(page.locator("th").filter({ hasText: /tipo/i })).toBeVisible();
  });

  test("T02: Admin can access create provider dialog with new fields", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click("button:has-text('Nuevo')");
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    // Check new fields exist
    await expect(page.locator("#provType")).toBeVisible();
    await expect(page.locator("#provApiKey")).toBeVisible();
  });

  test("T03: Admin can view AI models page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-models`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="ai-models-page"]')).toBeVisible({ timeout: 10000 });
    // Should have tabs for Models and Assignments
    await expect(page.locator('[role="tablist"]')).toBeVisible();
  });

  test("T04: Admin can open create model dialog", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-models`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click("button:has-text('Nuevo Modelo')");
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    // Check model form fields
    await expect(page.locator("#mModelId")).toBeVisible();
    await expect(page.locator("#mDisplayName")).toBeVisible();
  });

  test("T05: AI models page shows assignments tab", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-models`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click('[role="tab"]:has-text("Asignaciones")');
    await expect(page.locator("text=Nueva Asignación")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("AI Governance — Conversations & Traceability", () => {
  test("T06: Admin can view conversations list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-conversations`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="ai-conversations-page"]')).toBeVisible({ timeout: 10000 });
  });

  test("T07: Conversations page has search input", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-conversations`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible({ timeout: 10000 });
  });

  test("T08: Enhanced analytics page loads with tabs", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-analytics`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="ai-analytics-page"]')).toBeVisible({ timeout: 10000 });
    // Check tab structure
    await expect(page.locator('[role="tab"]:has-text("Resumen")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Por Modelo")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Por Usuario")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Alertas")')).toBeVisible();
  });

  test("T09: Analytics per-model tab renders", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-analytics`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click('[role="tab"]:has-text("Por Modelo")');
    await expect(page.getByRole("tabpanel", { name: "Por Modelo" })).toBeVisible({ timeout: 5000 });
  });

  test("T10: Analytics per-user tab renders", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-analytics`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click('[role="tab"]:has-text("Por Usuario")');
    await expect(page.getByRole("tabpanel", { name: "Por Usuario" })).toBeVisible({ timeout: 5000 });
  });

  test("T11: Analytics alerts tab renders", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-analytics`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click('[role="tab"]:has-text("Alertas")');
    await expect(page.getByRole("tabpanel", { name: "Alertas" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("AI Governance — CSV Export", () => {
  test("T12: CSV export endpoint requires auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/ai-export?type=costs&format=csv`, {
      ignoreHTTPSErrors: true,
    });
    // Should return 401 without auth
    expect(res.status()).toBe(401);
  });

  test("T13: CSV export endpoint rejects invalid type", async ({ page, request }) => {
    await loginAsAdmin(page);
    // Get cookies from authenticated session
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await request.get(`${BASE}/api/admin/ai-export?type=invalid&format=csv`, {
      ignoreHTTPSErrors: true,
      headers: { Cookie: cookieHeader },
    });
    expect([400, 401, 403]).toContain(res.status());
  });
});

test.describe("AI Governance — Permissions", () => {
  test("T14: Admin can view permissions page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('[data-testid="ai-permissions-page"]')).toBeVisible({ timeout: 10000 });
  });

  test("T15: Permissions page has department/role/user tabs", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await expect(page.locator('[role="tab"]:has-text("Por Departamento")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Por Rol")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Por Usuario")')).toBeVisible();
  });

  test("T16: Admin can open create permission dialog", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click("button:has-text('Nueva Regla')");
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    // Check form fields
    await expect(page.locator("#pTargetType")).toBeVisible();
    await expect(page.locator("#pCanAccess")).toBeVisible();
    await expect(page.locator("#pBlockedTools")).toBeVisible();
  });

  test("T17: Permission dialog target options change based on type", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click("button:has-text('Nueva Regla')");
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    // Switch target type to "user"
    await page.click("#pTargetType");
    await page.click('[role="option"]:has-text("Usuario")');
    // The target dropdown should now show user options
    await expect(page.locator("#pTargetId")).toBeVisible();
  });

  test("T18: Permissions role tab renders table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click('[role="tab"]:has-text("Por Rol")');
    await expect(page.locator('[role="tabpanel"] table')).toBeVisible({ timeout: 5000 });
  });

  test("T19: Permissions user tab renders table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    await page.click('[role="tab"]:has-text("Por Usuario")');
    await expect(page.locator('[role="tabpanel"] table')).toBeVisible({ timeout: 5000 });
  });
});

test.describe("AI Governance — Admin Sidebar Navigation", () => {
  test("T20: Admin sidebar shows AI governance links", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });
    // Check new sidebar items exist
    await expect(page.locator('a[href="/admin/ai-models"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/admin/ai-conversations"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/ai-permissions"]')).toBeVisible();
  });
});
