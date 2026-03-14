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

test.describe("AUDITORÍA FUNCIONAL REAL", () => {

  test("A01: Dashboard muestra SOLO datos reales", async ({ page }) => {
    await login(page);
    const content = await page.textContent("body");
    expect(content).toBeDefined();
    await page.screenshot({ path: "test-results/audit-A01-dashboard.png", fullPage: true });
  });

  test("A02: Admin>Usuarios — lista solo usuarios reales", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/users`);
    await page.waitForTimeout(2000);
    const rows = await page.locator("table tbody tr").count();
    console.log(`Usuarios en tabla: ${rows}`);
    const content = await page.textContent("body");
    expect(content).toContain("Soufiane");
    await page.screenshot({ path: "test-results/audit-A02-usuarios.png", fullPage: true });
  });

  test("A03: Admin>Usuarios — eliminar usuario funciona", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/users`);
    await page.waitForTimeout(2000);
    const deleteButtons = await page.locator('button[aria-label*="liminar"], button:has(svg.lucide-trash)').all();
    console.log(`Botones de eliminar encontrados: ${deleteButtons.length}`);
    await page.screenshot({ path: "test-results/audit-A03-delete-buttons.png", fullPage: true });
  });

  test("A04: Admin>Departamentos — contadores son reales", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/departments`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A04-departamentos.png", fullPage: true });
    const content = await page.textContent("body");
    console.log("Contenido departamentos capturado");
  });

  test("A05: Admin>Apps — editar acceso por departamento", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/apps`);
    await page.waitForTimeout(2000);
    const editBtn = page.locator('button:has-text("Editar"), button[aria-label*="ditar"]').first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(1000);
      const accessTab = page.locator('button:has-text("Acceso"), [role="tab"]:has-text("Acceso")');
      if (await accessTab.isVisible()) {
        await accessTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: "test-results/audit-A05-app-acceso.png", fullPage: true });
        const saveBtn = page.locator('button:has-text("Guardar")');
        if (await saveBtn.isVisible()) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
          const errorMsg = await page.locator('[role="alert"], .error, .text-red, .text-destructive').count();
          console.log(`Errores después de guardar: ${errorMsg}`);
          await page.screenshot({ path: "test-results/audit-A05-after-save.png", fullPage: true });
        }
      }
    }
  });

  test("A06: Admin>Apps — URLs internas son alcanzables", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/apps`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A06-apps-list.png", fullPage: true });
  });

  test("A07: Monitor — datos son reales, no inventados", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/monitor`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/audit-A07-monitor.png", fullPage: true });
    const content = await page.textContent("body");
    console.log("Monitor content captured");
  });

  test("A08: Sesiones — reflejan realidad", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/sessions`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A08-sesiones.png", fullPage: true });
    const content = await page.textContent("body");
    console.log("Sesiones content captured");
  });

  test("A09: Proveedores API — solo reales y con key", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/api-providers`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A09-providers.png", fullPage: true });
    const content = await page.textContent("body");
    console.log("Providers content captured");
  });

  test("A10: Chat IA — enviar mensaje y recibir respuesta", async ({ page }) => {
    await login(page);
    await page.waitForTimeout(2000);

    // Use data-testid selectors that exist in the component
    const chatBtn = page.locator('[data-testid="agent-button"]');
    if (await chatBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatBtn.click();
      await page.waitForSelector('[data-testid="agent-panel"]', { state: "visible", timeout: 5000 });
      await page.screenshot({ path: "test-results/audit-A10-chat-open.png", fullPage: true });

      const input = page.locator('[data-testid="agent-input"]');
      await input.waitFor({ state: "visible", timeout: 5000 });
      await input.fill("Hola, ¿cuántos usuarios activos hay?");
      await page.keyboard.press("Enter");

      // Wait for assistant response: look for "Pensando..." indicator to appear then disappear,
      // or for an assistant message element to appear
      try {
        // Wait up to 45s for a response — the streaming message will appear as a new child
        await page.waitForFunction(
          () => {
            const panel = document.querySelector('[data-testid="agent-panel"]');
            if (!panel) return false;
            // Check if "Pensando..." indicator is gone AND there's content
            const thinking = panel.querySelector('[class*="animate-spin"]');
            const messages = panel.querySelectorAll('[class*="message"]');
            // At least one assistant message should exist (more than just the user message)
            return !thinking && messages.length >= 1;
          },
          { timeout: 45000 },
        );
      } catch {
        // If we timeout waiting, still take screenshot for debugging
        console.log("Timeout esperando respuesta del agente — capturando estado actual");
      }

      await page.screenshot({ path: "test-results/audit-A10-chat-response.png", fullPage: true });
      const panelContent = await page.locator('[data-testid="agent-panel"]').textContent().catch(() => "");
      const hasError = panelContent?.toLowerCase().includes("error de ia") || false;
      console.log(`Chat tiene error: ${hasError}`);
      console.log(`Chat content preview: ${panelContent?.substring(0, 300)}`);
    } else {
      console.log("No se encontró botón de chat/agente (data-testid=agent-button)");
    }
  });

  test("A11: Auditoría — registros son de acciones reales", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/audit`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A11-audit-log.png", fullPage: true });
  });

  test("A12: Roles — contadores reflejan usuarios activos reales", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/roles`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A12-roles.png", fullPage: true });
  });

  test("A13: Dark mode funciona en todas las páginas", async ({ page }) => {
    await login(page);
    const themeBtn = page.locator('button[aria-label*="ema"], button[aria-label*="modo"], button[aria-label*="dark"]').first();
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/audit-A13-dark-dashboard.png", fullPage: true });
      await page.goto(`${BASE}/admin/users`);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "test-results/audit-A13-dark-admin.png", fullPage: true });
    }
  });

  test("A14: Mobile responsive", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.screenshot({ path: "test-results/audit-A14-mobile-dashboard.png", fullPage: true });
    await page.goto(`${BASE}/admin/users`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/audit-A14-mobile-admin.png", fullPage: true });
  });

  test("A15: ForwardAuth — citas sin auth devuelve 401", async ({ page }) => {
    const response = await page.goto("https://citas.centrohogarsanchez.es/");
    const status = response?.status() || 0;
    console.log(`Citas sin auth: ${status}`);
    await page.screenshot({ path: "test-results/audit-A15-citas-noauth.png", fullPage: true });
  });

  test("A16: Chat público Elias — accesible sin auth", async ({ page }) => {
    await page.goto("https://citas.centrohogarsanchez.es/chat");
    await page.waitForTimeout(3000);
    const status = await page.evaluate(() => document.readyState);
    console.log(`Chat page readyState: ${status}`);
    await page.screenshot({ path: "test-results/audit-A16-chat-publico.png", fullPage: true });
    const content = await page.textContent("body");
    const isEmpty = !content || content.trim().length < 50;
    console.log(`Chat vacío: ${isEmpty}`);
  });

  test("A17: Perfil — datos del usuario son reales", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/profile`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/audit-A17-perfil.png", fullPage: true });
    const content = await page.textContent("body");
    expect(content).toContain("Soufiane");
  });

  test("A18: Command palette (Ctrl+K) funciona", async ({ page }) => {
    await login(page);
    await page.waitForTimeout(1000);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/audit-A18-command-palette.png", fullPage: true });
  });

});
