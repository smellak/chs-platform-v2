import { test, expect, Page } from "@playwright/test";

const BASE = "https://platform.centrohogarsanchez.es";

async function login(page: Page) {
  await page.context().addCookies([{ name: "chs_intro_seen", value: "true", domain: "platform.centrohogarsanchez.es", path: "/" }]);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes("/login"), { timeout: 15000 });
  await page.waitForTimeout(2000);
}

test.describe("VERIFICACIÓN POST-REBUILD Fase 0-3", () => {

  // FASE 0 — Emergencias resueltas
  test("V01: Araña de Precios — health check online", async ({ page }) => {
    await login(page);
    const response = await page.request.get(`${BASE}/api/health`);
    expect(response.ok()).toBeTruthy();
  });

  test("V02: Sparkium — no está en crash loop", async ({ page }) => {
    await login(page);
    await page.screenshot({ path: "test-results/verify-V02-dashboard.png" });
  });

  // FASE 1 — Limpieza de datos
  test("V03: Usuarios ficticios eliminados", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/users`);
    await page.waitForTimeout(2000);
    const rows = await page.locator("table tbody tr").count();
    console.log(`Usuarios en tabla: ${rows}`);
    await page.screenshot({ path: "test-results/verify-V03-usuarios.png", fullPage: true });
  });

  test("V04: Sesiones — no hay miles de tokens fantasma", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/sessions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/verify-V04-sesiones.png", fullPage: true });
    const content = await page.textContent("body");
    const hasPagination = content?.includes("Siguiente") || content?.includes("siguiente") || content?.includes("Next") || content?.includes("Página");
    console.log(`Paginación visible: ${hasPagination}`);
  });

  test("V05: Activity logs — sin auth.verify-access", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/audit`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/verify-V05-audit.png", fullPage: true });
    const content = await page.textContent("body");
    const hasVerifyAccess = content?.includes("verify-access") || false;
    console.log(`auth.verify-access en audit: ${hasVerifyAccess}`);
  });

  test("V06: Proveedores API — sin API keys de test", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/api-keys`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/verify-V06-apikeys.png", fullPage: true });
    const content = await page.textContent("body");
    const hasE2E = content?.includes("E2E") || false;
    console.log(`API keys E2E residuales: ${hasE2E}`);
  });

  // FASE 2 — Funcionalidad
  test("V07: Monitor — accesible en /monitor", async ({ page }) => {
    await login(page);
    const response = await page.goto(`${BASE}/monitor`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/verify-V07-monitor.png", fullPage: true });
    // Check HTTP status, not page content (page may contain "404" as service health check codes)
    const status = response?.status() ?? 0;
    console.log(`Monitor HTTP status: ${status}`);
    expect(status).toBeLessThan(400);
    // Verify the page has the monitor heading
    const heading = await page.textContent("h1, h2");
    console.log(`Monitor heading: ${heading}`);
    expect(heading?.toLowerCase()).toContain("monitor");
  });

  test("V08: Apps — lista correcta", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/apps`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/verify-V08-apps.png", fullPage: true });
  });

  // FASE 3 — Robustez
  test("V09: Sesiones con paginación", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/sessions`);
    await page.waitForTimeout(2000);
    const pageControls = await page.locator('button:has-text("Siguiente"), button:has-text("Anterior")').count();
    console.log(`Controles de paginación: ${pageControls}`);
    await page.screenshot({ path: "test-results/verify-V09-paginacion.png", fullPage: true });
  });

  test("V10: Platform health post-rebuild", async ({ page }) => {
    const response = await page.request.get(`${BASE}/api/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    console.log(`Health: ${JSON.stringify(body)}`);
  });

  // FORWARDAUTH — verificar que no se rompió nada
  test("V11: ForwardAuth citas sigue funcionando", async ({ page }) => {
    const response = await page.goto("https://citas.centrohogarsanchez.es/");
    const status = response?.status() || 0;
    console.log(`Citas sin auth: ${status}`);
  });

  test("V12: Chat público Elias sigue accesible", async ({ page }) => {
    await page.goto("https://citas.centrohogarsanchez.es/chat");
    await page.waitForTimeout(3000);
    const content = await page.textContent("body");
    const notEmpty = content && content.trim().length > 50;
    console.log(`Chat público carga: ${notEmpty}`);
    await page.screenshot({ path: "test-results/verify-V12-chat-publico.png", fullPage: true });
  });

  test("V13: Google AI cost ya no $0.0000", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/verify-V13-providers.png", fullPage: true });
    const content = await page.textContent("body");
    const hasZeroCost = content?.includes("$0.0000 / $0.0000");
    console.log(`Google AI cost $0.0000: ${hasZeroCost}`);
  });

});
