import { test, expect, type Page } from "@playwright/test";

const BASE = process.env["TEST_BASE_URL"] ?? "http://localhost:3002";

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
  await page.waitForLoadState("networkidle");
}

test.describe("Fase 2: Integration Engine", () => {
  // === VERIFY-ACCESS ===

  test("T01: verify-access 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(401);
    const errorHeader = res.headers()["x-aleph-error"];
    expect(errorHeader).toBe("no-token");
  });

  test("T02: verify-access 200 with valid cookie + registered domain", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["x-aleph-user-id"]).toBeDefined();
    expect(res.headers()["x-aleph-user-name"]).toBeDefined();
    expect(res.headers()["x-aleph-user-email"]).toBeDefined();
    expect(res.headers()["x-aleph-org-id"]).toBeDefined();
    expect(res.headers()["x-aleph-dept"]).toBeDefined();
    expect(res.headers()["x-aleph-role"]).toBe("super-admin");
    expect(res.headers()["x-aleph-access-level"]).toBe("full");
  });

  test("T03: verify-access 403 for unregistered domain", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "unknown.example.com" },
    });
    expect(res.status()).toBe(403);
    expect(res.headers()["x-aleph-error"]).toBe("app-not-found");
  });

  test("T04: verify-access readonly access level for viewer user", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "ana.rodriguez", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["x-aleph-access-level"]).toBe("readonly");
  });

  test("T05: verify-access full access for Logistica user", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "carlos.martinez", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["x-aleph-access-level"]).toBe("full");
  });

  test("T06: verify-access returns X-Aleph-Permissions header", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(200);
    const perms = res.headers()["x-aleph-permissions"];
    expect(perms).toBeDefined();
    const parsed = JSON.parse(perms!);
    expect(parsed["apps.read"]).toBe(true);
  });

  // === SSO INFO ===

  test("T07: SSO info endpoint returns header documentation", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/auth/sso-info`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.platform).toBe("Aleph");
    expect(data.headers).toBeDefined();
    expect(data.headers["X-Aleph-User-Id"]).toBeDefined();
    expect(data.headers["X-Aleph-Role"]).toBeDefined();
  });

  // === TRAEFIK CONFIG PREVIEW ===

  test("T08: App edit has Instance tab with proxy controls", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/apps`);
    await expect(
      page.locator("h1:has-text('Gestión de Aplicaciones')"),
    ).toBeVisible({ timeout: 10000 });
    const editBtn = page.locator("text=Editar").first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      // Switch to Instance tab
      await page.click('button:has-text("Instancia")');
      await expect(page.locator("text=Proxy Traefik")).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.locator("text=Vista previa YAML"),
      ).toBeVisible();
    }
  });

  test("T09: Traefik YAML preview API works", async ({ request }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const appsRes = await request.get(`${BASE}/api/apps`);
    expect(appsRes.status()).toBe(200);
    const apps = await appsRes.json();
    const citas = apps.find(
      (a: Record<string, unknown>) => a.slug === "citas-almacen",
    );
    expect(citas).toBeDefined();
    if (citas) {
      const previewRes = await request.get(
        `${BASE}/api/apps/${citas.id}/traefik-preview`,
      );
      expect(previewRes.status()).toBe(200);
      const { yaml } = await previewRes.json();
      expect(yaml).toContain("aleph-forward-auth@file");
      expect(yaml).toContain("citas.centrohogarsanchez.es");
      expect(yaml).toContain("certResolver");
      expect(yaml).toContain("letsencrypt");
    }
  });

  // === MONITOR API ===

  test("T10: Monitor overview endpoint returns stats", async ({ request }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/monitor/overview`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(typeof data.totalApps).toBe("number");
    expect(typeof data.onlineApps).toBe("number");
    expect(typeof data.offlineApps).toBe("number");
    expect(typeof data.maintenanceApps).toBe("number");
  });

  test("T11: Monitor services endpoint returns array", async ({ request }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/monitor/services`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      expect(data[0].name).toBeDefined();
      expect(data[0].status).toBeDefined();
    }
  });

  test("T12: Monitor page shows real service data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/monitor`);
    await expect(
      page.locator("h1:has-text('Monitor de Servicios')"),
    ).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Total Apps");
    expect(body).toContain("En línea");
    expect(body).toContain("Citas");
  });

  // === API KEYS ===

  test("T13: Admin API keys page shows", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-keys`);
    await expect(
      page.locator("h1:has-text('Claves API')"),
    ).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Nueva Clave API");
  });

  test("T14: Create API key shows generated key", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-keys`);
    await expect(
      page.locator("h1:has-text('Claves API')"),
    ).toBeVisible({ timeout: 10000 });
    await page.click("text=Nueva Clave API");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', "Test Key E2E");
    await page.click('button:has-text("Crear Clave")');
    // Should show the generated key
    await expect(
      page.locator("text=Esta clave solo se mostrará una vez"),
    ).toBeVisible({ timeout: 10000 });
    const keyText = await page.locator("code").first().textContent();
    expect(keyText).toContain("aleph_sk_");
  });

  // === WEBHOOKS ===

  test("T15: Admin webhooks page shows", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/webhooks`);
    await expect(
      page.locator("h1:has-text('Webhooks')"),
    ).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Nuevo Webhook");
  });

  // === ACTIVITY LOGS ===

  test("T16: Activity logs API returns verify-access entries", async ({
    request,
  }) => {
    // Do a verify-access first to create log entries
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    const logsRes = await request.get(
      `${BASE}/api/activity-logs?action=auth.verify-access`,
    );
    expect(logsRes.status()).toBe(200);
    const logs = await logsRes.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThan(0);
  });

  // === CROSS-DOMAIN COOKIE ===

  test("T17: Login sets aleph_access_token cookie", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    expect(res.status()).toBe(200);
    const cookies = res.headers()["set-cookie"] ?? "";
    expect(cookies).toContain("aleph_access_token");
  });

  // === SDK ===

  test("T18: SDK package builds correctly", async ({}) => {
    const { execSync } = require("child_process");
    const result = execSync(
      "cd /home/aleph/aleph-platform/packages/sdk && npm run build 2>&1",
    ).toString();
    expect(result).not.toContain("error TS");
  });

  // === ADMIN SIDEBAR ===

  test("T19: Admin sidebar shows API Keys and Webhooks links", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`);
    await expect(
      page.locator("h1:has-text('Gestión de Usuarios')"),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('a:has-text("Claves API")').first(),
    ).toBeVisible();
    await expect(
      page.locator('a:has-text("Webhooks")').first(),
    ).toBeVisible();
  });

  // === NO REGRESSION ===

  test("T20: Elias not affected", async ({ request }) => {
    const res = await request.get(
      "https://elias.centrohogarsanchez.es/api/health",
      { ignoreHTTPSErrors: true },
    );
    expect(res.status()).toBe(200);
  });
});
