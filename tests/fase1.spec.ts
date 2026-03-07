import { test, expect, type Page } from "@playwright/test";

const BASE = process.env["TEST_BASE_URL"] ?? "http://localhost:3001";

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
  // Wait for hydration and content to load
  await page.waitForLoadState("networkidle");
}

test.describe("Fase 1: Core Platform UI", () => {
  // ─── Dashboard ────────────────────────────────────────────────────────────

  test("T1: Dashboard shows hero with greeting and stats", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("text=Servicios activos")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toMatch(/Buenos (días|tardes|noches)/);
    expect(body).toContain("Departamentos");
    expect(body).toContain("Aplicaciones");
  });

  test("T2: Dashboard shows department sections with app cards", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await expect(page.locator("text=Servicios activos")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    // Check for app name from seed data
    expect(body).toContain("Citas");
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  test("T3: Navbar shows ALEPH brand, Dashboard, Monitor, Admin links", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
    const nav = page.locator("nav");
    await expect(nav).toContainText("ALEPH");
    await expect(nav).toContainText("Dashboard");
    await expect(nav).toContainText("Monitor");
    await expect(nav).toContainText("Admin");
  });

  test("T4: Navbar shows notification bell", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
    const bellButton = page.locator('button[aria-label="Notificaciones"]');
    await expect(bellButton).toBeVisible({ timeout: 5000 });
  });

  test("T5: Navbar shows theme toggle", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
    const toggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(toggle).toBeVisible({ timeout: 5000 });
  });

  // ─── Admin - Users ────────────────────────────────────────────────────────

  test("T6: Admin users page shows user list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator("text=Gestión de Usuarios")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("admin");
    expect(body).toContain("Nuevo Usuario");
  });

  test("T7: Admin users page shows create user dialog", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator("text=Nuevo Usuario")).toBeVisible({ timeout: 10000 });
    await page.click("text=Nuevo Usuario");
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toContainText("Nombre");
    await expect(dialog).toContainText("Username");
    await expect(dialog).toContainText("Contraseña");
  });

  // ─── Admin - Departments ──────────────────────────────────────────────────

  test("T8: Admin departments page shows department list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/departments`);
    await expect(page.locator("text=Gestión de Departamentos")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Nuevo Departamento");
  });

  // ─── Admin - Apps ─────────────────────────────────────────────────────────

  test("T9: Admin apps page shows app list with tabs in dialog", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/apps`);
    await expect(page.locator("text=Gestión de Aplicaciones")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Nueva Aplicación");
    // Open edit dialog to check tabs
    const editBtn = page.locator("text=Editar").first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog).toContainText("Datos");
      await expect(dialog).toContainText("Instancia");
      await expect(dialog).toContainText("Acceso");
      await expect(dialog).toContainText("Agente IA");
    }
  });

  // ─── Admin - Roles ────────────────────────────────────────────────────────

  test("T10: Admin roles page shows roles list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/roles`);
    await expect(page.locator("text=Gestión de Roles")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Nuevo Rol");
    expect(body).toContain("admin");
  });

  // ─── Admin - Audit ────────────────────────────────────────────────────────

  test("T11: Admin audit page shows audit logs with filters", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/audit`);
    await expect(page.locator("text=Registro de Auditoría")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Todas las acciones");
  });

  // ─── Admin - API Providers ────────────────────────────────────────────────

  test("T12: Admin API providers page shows providers", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await expect(page.locator("h1:has-text('Proveedores API')")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Nuevo Proveedor");
  });

  // ─── Admin Sidebar ────────────────────────────────────────────────────────

  test("T13: Admin sidebar shows all navigation items", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`);
    await expect(page.locator("text=Gestión de Usuarios")).toBeVisible({ timeout: 10000 });
    const sidebarLinks = [
      "Usuarios",
      "Departamentos",
      "Aplicaciones",
      "Roles",
      "Auditoría",
      "Proveedores API",
      "Claves API",
      "Webhooks",
    ];
    for (const link of sidebarLinks) {
      await expect(page.locator(`a:has-text("${link}")`).first()).toBeVisible();
    }
  });

  // ─── Monitor ──────────────────────────────────────────────────────────────

  test("T14: Monitor page shows service status cards", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/monitor`);
    await expect(page.locator("text=Monitor de Servicios")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Total Apps");
    expect(body).toContain("En línea");
  });

  test("T15: Monitor page shows services table", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/monitor`);
    await expect(page.locator("text=Estado de Servicios")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Citas");
  });

  test("T16: Monitor page shows API costs chart", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/monitor`);
    await expect(page.locator("text=Costes API")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Últimos 7 días");
  });

  test("T17: Monitor page shows recent activity", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/monitor`);
    await expect(page.locator("text=Actividad reciente")).toBeVisible({ timeout: 10000 });
  });

  // ─── Profile ──────────────────────────────────────────────────────────────

  test("T18: Profile page shows personal data form", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/profile`);
    await expect(page.locator("text=Mi Perfil")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Datos personales");
    expect(body).toContain("Guardar cambios");
  });

  test("T19: Profile page shows change password form", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/profile`);
    await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Contraseña actual");
    expect(body).toContain("Nueva contraseña");
  });

  test("T20: Profile page shows preferences with theme selection", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/profile`);
    await expect(page.locator("text=Preferencias")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toContain("Claro");
    expect(body).toContain("Oscuro");
  });

  // ─── Dark Mode ────────────────────────────────────────────────────────────

  test("T21: Theme toggle switches between light and dark", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
    const toggle = page.locator('button[aria-label="Toggle theme"]');
    await toggle.click();
    await page.waitForTimeout(500);
    const html = page.locator("html");
    const classAttr = await html.getAttribute("class");
    expect(classAttr).toContain("dark");
  });

  // ─── 404 ──────────────────────────────────────────────────────────────────

  test("T22: 404 page renders for unknown routes", async ({ page }) => {
    await page.goto(`${BASE}/this-page-does-not-exist`);
    await page.waitForLoadState("networkidle");
    const body = await page.textContent("body");
    expect(body).toContain("404");
  });

  // ─── Command Palette ──────────────────────────────────────────────────────

  test("T23: Command palette opens with Ctrl+K", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });
    await page.keyboard.press("Control+k");
    const searchInput = page.locator(
      'input[placeholder*="Buscar acciones"]',
    );
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  // ─── Responsive ───────────────────────────────────────────────────────────

  test("T24: Dashboard is responsive at 375px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAsAdmin(page);
    await expect(page.locator("text=Servicios activos")).toBeVisible({ timeout: 10000 });
    const body = await page.textContent("body");
    expect(body).toMatch(/Buenos (días|tardes|noches)/);
  });

  // ─── Non-admin access ────────────────────────────────────────────────────

  test("T25: Non-admin user can access dashboard but not admin", async ({
    page,
  }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "carlos.martinez");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.toString().includes("/login"), {
      timeout: 15000,
    });
    await page.waitForLoadState("networkidle");
    // Dashboard should load
    const body = await page.textContent("body");
    expect(body).toMatch(/Buenos (días|tardes|noches)/);
    // Admin link should not be in navbar for non-admin
    const nav = page.locator("nav");
    const navText = await nav.textContent();
    expect(navText).not.toContain("Admin");
  });
});
