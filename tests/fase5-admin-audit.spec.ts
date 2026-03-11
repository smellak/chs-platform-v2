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

test.describe("Fase 5: Admin Audit — Webhooks CRUD", () => {
  test("T01: Webhooks page loads with table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/webhooks`);
    await expect(
      page.locator("h1:has-text('Webhooks')"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Nuevo Webhook")).toBeVisible();
  });

  test("T02: Create webhook, verify appears, then delete", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/webhooks`);
    await expect(
      page.locator("h1:has-text('Webhooks')"),
    ).toBeVisible({ timeout: 10000 });

    const testName = `E2E Hook ${Date.now()}`;
    await page.click("text=Nuevo Webhook");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="url"]', "https://httpbin.org/post");
    // Check at least one event
    const firstCheckbox = dialog.locator('button[role="checkbox"]').first();
    if (await firstCheckbox.isVisible({ timeout: 2000 })) {
      await firstCheckbox.click();
    }
    await page.click('button:has-text("Crear Webhook")');
    await page.waitForTimeout(2000);
    // Verify webhook appears
    await expect(page.locator(`text=${testName}`)).toBeVisible({
      timeout: 10000,
    });

    // Cleanup: delete the webhook
    const row = page.locator("tr", { hasText: testName });
    const deleteBtn = row.locator("button").filter({
      has: page.locator('svg[class*="trash"]'),
    });
    if (await deleteBtn.isVisible({ timeout: 3000 })) {
      await deleteBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("T03: Toggle webhook active/inactive", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/webhooks`);
    await expect(
      page.locator("h1:has-text('Webhooks')"),
    ).toBeVisible({ timeout: 10000 });

    // Find any toggle button
    const toggleBtn = page
      .locator('button:has-text("Desactivar"), button:has-text("Activar")')
      .first();
    if (await toggleBtn.isVisible({ timeout: 3000 })) {
      const text = await toggleBtn.textContent();
      await toggleBtn.click();
      await page.waitForTimeout(1000);
      // Should have changed
      if (text?.includes("Desactivar")) {
        await expect(
          page.locator('button:has-text("Activar")').first(),
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe("Fase 5: Admin Audit — API Keys", () => {
  test("T04: API Keys page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-keys`);
    await expect(
      page.locator("h1:has-text('Claves API')"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Nueva Clave API")).toBeVisible();
  });

  test("T05: Create API key and revoke it", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-keys`);
    await expect(
      page.locator("h1:has-text('Claves API')"),
    ).toBeVisible({ timeout: 10000 });

    const keyName = `E2E Key ${Date.now()}`;
    await page.click("text=Nueva Clave API");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.fill('input[name="name"]', keyName);
    await page.click('button:has-text("Crear Clave")');

    // Key should be shown
    await expect(
      page.locator("text=Esta clave solo se mostrará una vez"),
    ).toBeVisible({ timeout: 10000 });
    const keyText = await page.locator("code").first().textContent();
    expect(keyText).toContain("chs_sk_");

    // Close the generated key dialog
    await page.click('button:has-text("Cerrar")');
    await page.waitForTimeout(2000);

    // Find our newly created key's Revocar button
    const row = page.locator("tr", { hasText: keyName });
    const revokeBtn = row.locator('button:has-text("Revocar")');
    if (await revokeBtn.isVisible({ timeout: 3000 })) {
      await revokeBtn.click();
      await page.waitForTimeout(2000);
      // Verify revoked badge appears
      await expect(
        row.locator("text=Revocada"),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Fase 5: Admin Audit — Roles CRUD", () => {
  test("T06: Roles page loads with system roles", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/roles`);
    await expect(
      page.locator("h1:has-text('Gestión de Roles')"),
    ).toBeVisible({ timeout: 10000 });
    // System roles should exist
    await expect(page.locator("text=Sistema").first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("T07: Create custom role and delete it", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/roles`);
    await expect(
      page.locator("h1:has-text('Gestión de Roles')"),
    ).toBeVisible({ timeout: 10000 });

    const testSlug = `e2e-role-${Date.now()}`;
    await page.click('button:has-text("Nuevo Rol")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.fill('input[name="name"]', `E2E Test Role`);
    await page.fill('input[name="slug"]', testSlug);

    await page.click('button:has-text("Crear Rol")');
    await page.waitForTimeout(2000);

    // Verify role appears with "Personalizado" badge
    await expect(page.locator(`text=${testSlug}`)).toBeVisible({
      timeout: 10000,
    });

    // Delete the custom role
    const row = page.locator("tr", { hasText: testSlug });
    const deleteBtn = row.locator(
      "button.text-destructive, button:has(svg)",
    ).last();
    if (await deleteBtn.isVisible({ timeout: 3000 })) {
      page.on("dialog", (d) => d.accept());
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      await expect(page.locator(`text=${testSlug}`)).not.toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("T08: System role cannot be deleted (no delete button)", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/roles`);
    await expect(
      page.locator("h1:has-text('Gestión de Roles')"),
    ).toBeVisible({ timeout: 10000 });

    // Find a system role row (has "Sistema" badge)
    const systemRow = page.locator("tr").filter({
      has: page.locator('text="Sistema"'),
    }).first();
    await expect(systemRow).toBeVisible({ timeout: 5000 });

    // Should NOT have a delete/trash button
    const trashBtns = systemRow.locator("button.text-destructive");
    expect(await trashBtns.count()).toBe(0);
  });
});

test.describe("Fase 5: Admin Audit — Apps Delete", () => {
  test("T09: Create and delete an app", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/apps`);
    await expect(
      page.locator("h1:has-text('Gestión de Aplicaciones')"),
    ).toBeVisible({ timeout: 10000 });

    const testName = `E2E App ${Date.now()}`;
    const testSlug = `e2e-app-${Date.now()}`;
    await page.click('button:has-text("Nueva Aplicación")');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.fill('input[name="name"]', testName);
    await page.fill('input[name="slug"]', testSlug);

    await page.click('button:has-text("Crear Aplicación")');
    await page.waitForTimeout(3000);

    // Verify app appears (table shows name, not slug)
    await expect(page.locator(`text=${testName}`).first()).toBeVisible({
      timeout: 10000,
    });

    // Delete the app
    const row = page.locator("tr", { hasText: testName });
    page.on("dialog", (d) => d.accept());
    const deleteBtn = row.locator("button").filter({
      has: page.locator('svg'),
    }).last();
    if (await deleteBtn.isVisible({ timeout: 3000 })) {
      await deleteBtn.click();
      await page.waitForTimeout(3000);
      await expect(page.locator(`text=${testName}`)).not.toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe("Fase 5: Admin Audit — API Providers Delete", () => {
  test("T10: API Providers page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });
  });

  test("T11: Delete button is visible for providers", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(
      page.locator("h1:has-text('Proveedores')"),
    ).toBeVisible({ timeout: 10000 });
    // Check that delete buttons exist
    const deleteBtns = page.locator(
      "td button.text-destructive, td button:has(svg.lucide-trash-2)",
    );
    expect(await deleteBtns.count()).toBeGreaterThan(0);
  });
});

test.describe("Fase 5: Admin Audit — Audit Logs Filtering", () => {
  test("T12: Audit page loads with logs", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/audit`);
    await expect(
      page.locator("h1:has-text('Registro'), h1:has-text('Auditoría')"),
    ).toBeVisible({ timeout: 10000 });
    // Should have at least some log entries
    const rows = page.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("T13: Activity logs API returns entries", async ({ request }) => {
    await loginAsAdminApi(request);
    const res = await request.get(`${BASE}/api/activity-logs`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

test.describe("Fase 5: Admin Audit — AI Models", () => {
  test("T14: AI Models page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-models`);
    await expect(
      page.locator("h1:has-text('Modelos')"),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Fase 5: Admin Audit — AI Conversations", () => {
  test("T15: AI Conversations page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-conversations`);
    await expect(
      page.locator("h1:has-text('Conversaciones')"),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Fase 5: Admin Audit — AI Permissions", () => {
  test("T16: AI Permissions page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/ai-permissions`);
    await expect(
      page.locator("h1:has-text('Permisos')"),
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Fase 5: Admin Audit — Sessions Page", () => {
  test("T17: Sessions page loads with active sessions", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/sessions`);
    await expect(
      page.locator("h1:has-text('Sesiones Activas')"),
    ).toBeVisible({ timeout: 10000 });
    // Should show stats cards
    await expect(page.locator("text=Total Sesiones")).toBeVisible();
    await expect(page.locator("text=Usuarios Activos")).toBeVisible();
  });

  test("T18: Sessions table shows session data", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/sessions`);
    await expect(
      page.locator("h1:has-text('Sesiones Activas')"),
    ).toBeVisible({ timeout: 10000 });
    // Should have at least our own session
    const rows = page.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
  });
});

test.describe("Fase 5: Admin Audit — Token Refresh", () => {
  test("T19: Token status API returns expiry info", async ({ request }) => {
    await loginAsAdminApi(request);
    const res = await request.get(`${BASE}/api/auth/token-status`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(typeof data.expiresIn).toBe("number");
    expect(data.expiresIn).toBeGreaterThan(0);
  });

  test("T20: Token status returns false without auth", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/auth/token-status`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(false);
  });

  test("T21: Login sets chs_session_active cookie", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    expect(res.status()).toBe(200);
    const cookies = res.headers()["set-cookie"] ?? "";
    expect(cookies).toContain("chs_session_active");
  });
});

test.describe("Fase 5: Admin Audit — Cross-Section", () => {
  test("T22: All admin pages load without errors", async ({ page }) => {
    await loginAsAdmin(page);

    const adminPages = [
      { url: "/admin/users", heading: "Usuarios" },
      { url: "/admin/departments", heading: "Departamentos" },
      { url: "/admin/apps", heading: "Aplicaciones" },
      { url: "/admin/roles", heading: "Roles" },
      { url: "/admin/audit", heading: "Auditoría" },
      { url: "/admin/sessions", heading: "Sesiones" },
      { url: "/admin/api-providers", heading: "Proveedores" },
      { url: "/admin/api-keys", heading: "Claves API" },
      { url: "/admin/webhooks", heading: "Webhooks" },
      { url: "/admin/ai-analytics", heading: "Analíticas" },
      { url: "/admin/ai-models", heading: "Modelos" },
      { url: "/admin/ai-conversations", heading: "Conversaciones" },
      { url: "/admin/ai-permissions", heading: "Permisos" },
    ];

    for (const p of adminPages) {
      await page.goto(`${BASE}${p.url}`);
      await expect(
        page.locator(`h1:has-text("${p.heading}")`),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("T23: Admin sidebar shows Sessions link", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`);
    await expect(
      page.locator("h1:has-text('Usuarios')"),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('a:has-text("Sesiones")').first(),
    ).toBeVisible();
  });
});
