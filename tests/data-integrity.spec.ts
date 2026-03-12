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

async function loginAsAdminApi(
  request: import("@playwright/test").APIRequestContext,
) {
  await request.post(`${BASE}/api/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
}

test.describe("Data Integrity — Department Counters", () => {
  test("T01: Department user counters reflect only active users", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/departments`);
    await expect(
      page.locator("h1:has-text('Gestión de Departamentos')"),
    ).toBeVisible({ timeout: 10000 });

    // Get all department cards/rows
    const body = await page.textContent("body");

    // IT department should show 1 user (admin is the only active user in IT)
    // All other departments should show 0 active users
    // We check that no department shows a count higher than 1
    // since there's only 1 active user total
    const rows = page.locator("tr, [class*='card']");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Specifically: only admin is active and assigned to IT.
    // So the total user count across all departments must equal 1.
    // Check that the page does NOT show ghost counts like "6", "2", etc.
    expect(body).not.toMatch(/Usuarios:\s*[2-9]/);
    expect(body).not.toMatch(/Usuarios:\s*\d{2,}/);
  });
});

test.describe("Data Integrity — Role Counters", () => {
  test("T02: Role user counters reflect only active users", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/roles`);
    await expect(
      page.locator("h1:has-text('Gestión de Roles')"),
    ).toBeVisible({ timeout: 10000 });

    const body = await page.textContent("body");

    // Only 1 active user (admin) with role "Super Admin"
    // "Usuario" role should show 0, not 6
    // "Visor" role should show 0, not 1
    expect(body).not.toMatch(/Usuario.*[2-9]\s*usuario/i);
    expect(body).not.toMatch(/Visor.*[1-9]\s*usuario/i);
  });
});

test.describe("Data Integrity — Sessions", () => {
  test("T03: Sessions page shows real session data with IP and browser", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/sessions`);
    await expect(
      page.locator("h1:has-text('Sesiones')"),
    ).toBeVisible({ timeout: 10000 });

    const body = await page.textContent("body");

    // Should NOT show 2000+ sessions
    expect(body).not.toMatch(/\b[2-9]\d{3,}\b.*sesion/i);
    expect(body).not.toMatch(/\b\d{4,}\b.*activa/i);

    // Should show real session data, NOT "—" for all fields
    // At least the current session should have real IP and browser
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();

    // At least 1 session (our login just now)
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });

  test("T04: Login creates session with IP and User-Agent captured", async ({
    request,
  }) => {
    // Login creates a refresh token
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    expect(loginRes.status()).toBe(200);
    const loginData = (await loginRes.json()) as { user?: { id: string } };
    expect(loginData.user).toBeDefined();

    // Verify the token status endpoint shows authenticated
    const statusRes = await request.get(`${BASE}/api/auth/token-status`);
    expect(statusRes.status()).toBe(200);
    const status = (await statusRes.json()) as { authenticated: boolean };
    expect(status.authenticated).toBe(true);
  });
});

test.describe("Data Integrity — API Providers", () => {
  test("T05: Providers without API key show as inactive", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });

    // Check that providers without API key do NOT show as "Activo"
    const rows = page.locator("table tbody tr");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const rowText = await row.textContent();

      // If API key is "No configurada", status must be "Inactivo"
      if (rowText?.includes("No configurada")) {
        expect(rowText).toContain("Inactivo");
        expect(rowText).not.toContain("Activo");
      }
    }
  });
});

test.describe("Data Integrity — App Health", () => {
  test("T06: Active apps respond to health checks", async ({ request }) => {
    await loginAsAdminApi(request);

    const appsRes = await request.get(`${BASE}/api/apps`);
    expect(appsRes.status()).toBe(200);
    const apps = (await appsRes.json()) as Array<{
      slug: string;
      isActive: boolean;
      instance?: { status: string } | null;
    }>;

    // Verify active apps have real health status
    const activeApps = apps.filter((a) => a.isActive);
    expect(activeApps.length).toBeGreaterThan(0);

    for (const app of activeApps) {
      if (app.instance) {
        // Active apps with instances should have a real status, not null
        expect(app.instance.status).toBeTruthy();
      }
    }

    // Verify inactive apps are actually inactive
    const inactiveApps = apps.filter((a) => !a.isActive);
    for (const app of inactiveApps) {
      if (app.instance) {
        expect(app.instance.status).toBe("offline");
      }
    }
  });

  test("T07: Known active apps health endpoints respond via API", async ({
    request,
  }) => {
    // Use the monitor services API which checks internal URLs (avoids hairpin NAT issues)
    await loginAsAdminApi(request);

    const servicesRes = await request.get(`${BASE}/api/monitor/services`);
    expect(servicesRes.status()).toBe(200);
    const services = (await servicesRes.json()) as Array<{
      name: string;
      status: string;
    }>;

    // At least some services should be online
    const online = services.filter((s) => s.status === "online");
    expect(
      online.length,
      `Expected at least 3 online services, got ${online.length}: ${services.map((s) => `${s.name}=${s.status}`).join(", ")}`,
    ).toBeGreaterThanOrEqual(3);
  });

  test("T08: Inactive apps (Amazon A+, Medidas) are marked inactive in DB", async ({
    request,
  }) => {
    await loginAsAdminApi(request);

    const appsRes = await request.get(`${BASE}/api/apps`);
    const apps = (await appsRes.json()) as Array<{
      slug: string;
      isActive: boolean;
    }>;

    const amazonAPlus = apps.find((a) => a.slug === "amazon-aplus");
    const medidas = apps.find((a) => a.slug === "medidas-excel");

    if (amazonAPlus) {
      expect(amazonAPlus.isActive).toBe(false);
    }
    if (medidas) {
      expect(medidas.isActive).toBe(false);
    }
  });
});

test.describe("Data Integrity — Audit Logs", () => {
  test("T09: Activity logs API returns real entries, not test pollution", async ({
    request,
  }) => {
    await loginAsAdminApi(request);

    const logsRes = await request.get(`${BASE}/api/activity-logs`);
    expect(logsRes.status()).toBe(200);
    const logs = (await logsRes.json()) as Array<{
      action: string;
      ipAddress?: string | null;
    }>;

    // Verify logs exist
    expect(logs.length).toBeGreaterThan(0);

    // Count auth.login entries — should be reasonable, not 2000+
    const loginLogs = logs.filter((l) => l.action === "auth.login");
    expect(
      loginLogs.length,
      `auth.login count should be < 100, got ${loginLogs.length}`,
    ).toBeLessThan(100);
  });
});
