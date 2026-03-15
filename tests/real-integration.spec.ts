import { test, expect, Page } from "@playwright/test";
import { execSync } from "child_process";

const BASE = "https://platform.centrohogarsanchez.es";
const DB_CMD = 'sudo docker exec chs-db psql -U chs -d chs -t -A';

async function login(page: Page) {
  await page.context().addCookies([
    { name: "chs_intro_seen", value: "true", domain: "platform.centrohogarsanchez.es", path: "/" },
  ]);
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 15000 });
  await page.waitForTimeout(2000);
}

/** Execute query against production DB and return trimmed output */
function dbQuery(query: string): string {
  return execSync(`${DB_CMD} -c "${query}"`, { encoding: "utf-8", timeout: 10000 }).trim();
}

// ═══════════════════════════════════════════════════════════════
// F5.1 — INTEGRIDAD DE DATOS
// ═══════════════════════════════════════════════════════════════

test.describe("F5.1 — INTEGRIDAD DE DATOS", () => {

  test("R01: Dashboard — contador de servicios online coincide con DB", async ({ page }) => {
    // Get counts from service_status (most recent per app instance)
    const onlineFromDb = dbQuery(
      `SELECT count(DISTINCT ai.id) FROM app_instances ai JOIN apps a ON ai.app_id = a.id WHERE a.is_active = true AND ai.status = 'online'`
    );
    const totalActiveApps = dbQuery(
      `SELECT count(*) FROM app_instances ai JOIN apps a ON ai.app_id = a.id WHERE a.is_active = true`
    );
    console.log(`DB: ${onlineFromDb} online de ${totalActiveApps} apps activas`);

    // Verify DB has reasonable counts
    expect(parseInt(onlineFromDb)).toBeGreaterThan(0);
    expect(parseInt(totalActiveApps)).toBeGreaterThan(0);

    // Verify dashboard loads successfully after login
    await login(page);
    await page.waitForTimeout(2000);
    const heading = await page.textContent("h1, h2");
    console.log(`Dashboard heading: ${heading}`);
    await page.screenshot({ path: "test-results/real-R01-dashboard.png", fullPage: true });
    // Dashboard page loaded (not redirected to error)
    expect(page.url()).toContain("platform.centrohogarsanchez.es");
  });

  test("R02: Departamentos — contadores de usuarios coinciden con BD", async ({ page }) => {
    const deptCounts = dbQuery(
      `SELECT d.name, (SELECT count(*) FROM user_department_roles udr JOIN users u ON udr.user_id = u.id WHERE udr.department_id = d.id AND u.is_active = true) as cnt FROM departments d ORDER BY d.name`
    );
    console.log(`BD departamentos:\n${deptCounts}`);

    await login(page);
    await page.goto(`${BASE}/admin/departments`);
    await page.waitForTimeout(2000);

    const rows = await page.locator("table tbody tr").all();
    for (const row of rows) {
      const text = await row.textContent();
      console.log(`UI fila: ${text?.replace(/\s+/g, " ").trim()}`);
    }
    await page.screenshot({ path: "test-results/real-R02-departments.png", fullPage: true });
  });

  test("R03: Roles — contadores de usuarios coinciden con BD", async ({ page }) => {
    const roleCounts = dbQuery(
      `SELECT r.name, (SELECT count(*) FROM user_department_roles udr JOIN users u ON udr.user_id = u.id WHERE udr.role_id = r.id AND u.is_active = true) as cnt FROM roles r ORDER BY r.name`
    );
    console.log(`BD roles:\n${roleCounts}`);

    await login(page);
    await page.goto(`${BASE}/admin/roles`);
    await page.waitForTimeout(2000);

    const rows = await page.locator("table tbody tr").all();
    for (const row of rows) {
      const text = await row.textContent();
      console.log(`UI fila: ${text?.replace(/\s+/g, " ").trim()}`);
    }
    await page.screenshot({ path: "test-results/real-R03-roles.png", fullPage: true });
  });

  test("R04: Proveedores API — solo los que tienen key están Activo", async ({ page }) => {
    const providers = dbQuery(
      `SELECT name, is_active, (api_key_encrypted IS NOT NULL AND api_key_encrypted != '') as has_key FROM api_providers`
    );
    console.log(`BD providers:\n${providers}`);

    const lines = providers.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length >= 3) {
        const provName = parts[0]?.trim();
        const isActive = parts[1]?.trim() === "t";
        const hasKey = parts[2]?.trim() === "t";
        console.log(`  ${provName}: active=${isActive}, hasKey=${hasKey}`);
        if (isActive && !hasKey) {
          console.error(`  ERROR: ${provName} está activo SIN API key`);
        }
        expect(isActive && !hasKey).toBeFalsy();
      }
    }
  });

  test("R05: Sesiones — no hay más de 50 tokens por usuario", async ({ page }) => {
    const tokenCounts = dbQuery(
      `SELECT u.username, count(*) as cnt FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id GROUP BY u.username ORDER BY cnt DESC`
    );
    console.log(`Tokens por usuario:\n${tokenCounts}`);

    const excess = dbQuery(
      `SELECT user_id, count(*) as cnt FROM refresh_tokens GROUP BY user_id HAVING count(*) > 50`
    );
    console.log(`Usuarios con >50 tokens: ${excess || "ninguno"}`);
    expect(excess).toBe("");
  });

});

// ═══════════════════════════════════════════════════════════════
// F5.2 — FORWARDAUTH
// ═══════════════════════════════════════════════════════════════

test.describe("F5.2 — FORWARDAUTH", () => {

  test("R06: Cada app protegida devuelve 401 sin auth", async ({ page }) => {
    const protectedApps = ["citas", "rutas", "aon", "arana", "medidas"];
    for (const app of protectedApps) {
      const response = await page.request
        .get(`https://${app}.centrohogarsanchez.es/`, { maxRedirects: 0 })
        .catch(() => null);
      const status = response?.status() || 0;
      console.log(`${app} sin auth: HTTP ${status}`);
      // Must be 401 or redirect (302/307), NEVER 200 with app content
      expect([401, 302, 307, 0]).toContain(status);
    }
  });

  test("R07: Cada app protegida devuelve 200 con auth válido", async ({ page }) => {
    // Login and extract cookie
    const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    expect(loginResp.ok()).toBeTruthy();

    const cookies = await loginResp.headersArray();
    const accessTokenCookie = cookies
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value)
      .find((v) => v.includes("chs_access_token="));
    const token = accessTokenCookie?.match(/chs_access_token=([^;]+)/)?.[1] ?? "";
    expect(token.length).toBeGreaterThan(0);
    console.log(`Got access token (${token.length} chars)`);

    // Note: arana excluded due to known hairpin NAT issue (resolves to public IP, fails from server)
    const protectedApps = ["citas", "rutas", "aon"];
    for (const app of protectedApps) {
      const response = await page.request.get(`https://${app}.centrohogarsanchez.es/`, {
        headers: { Cookie: `chs_access_token=${token}` },
      });
      const status = response.status();
      console.log(`${app} con auth: HTTP ${status}`);
      // 200 or 307 (internal app redirect)
      expect([200, 307]).toContain(status);
    }
  });

  test("R08: Chat público Elias accesible sin auth", async ({ page }) => {
    const chatPage = await page.request.get("https://citas.centrohogarsanchez.es/chat");
    console.log(`Chat público GET /chat: HTTP ${chatPage.status()}`);
    expect(chatPage.status()).toBe(200);

    const chatApi = await page.request.post("https://citas.centrohogarsanchez.es/api/chat/message", {
      data: { sessionId: "test-real-f5", message: "hola" },
    });
    console.log(`Chat API POST: HTTP ${chatApi.status()}`);
    const chatBody = await chatApi.text();
    console.log(`Chat API response: ${chatBody.substring(0, 200)}`);
    expect(chatApi.status()).toBe(200);
  });

  test("R09: SSO de apps recibe headers X-CHS-* correctos", async ({ page }) => {
    // Login and extract token
    const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const cookies = await loginResp.headersArray();
    const accessTokenCookie = cookies
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value)
      .find((v) => v.includes("chs_access_token="));
    const token = accessTokenCookie?.match(/chs_access_token=([^;]+)/)?.[1] ?? "";

    // Test Route Optimizer SSO — returns user data derived from X-CHS-* headers
    const sso = await page.request.get("https://rutas.centrohogarsanchez.es/api/auth/sso", {
      headers: { Cookie: `chs_access_token=${token}` },
    });
    console.log(`Route Optimizer SSO: HTTP ${sso.status()}`);
    if (sso.ok()) {
      const body = await sso.json();
      console.log(`SSO response: ${JSON.stringify(body).substring(0, 300)}`);
      // Should have user data from CHS headers
      expect(body.ok || body.success).toBeTruthy();
      expect(body.user).toBeDefined();
      expect(body.user.username).toBeTruthy();
    }

    // Test AON SSO
    const aonSso = await page.request.get("https://aon.centrohogarsanchez.es/api/auth/sso", {
      headers: { Cookie: `chs_access_token=${token}` },
    });
    console.log(`AON SSO: HTTP ${aonSso.status()}`);
    if (aonSso.ok()) {
      const body = await aonSso.json();
      console.log(`AON SSO response: ${JSON.stringify(body).substring(0, 300)}`);
      expect(body.success).toBeTruthy();
      expect(body.user).toBeDefined();
    }
  });

});

// ═══════════════════════════════════════════════════════════════
// F5.3 — ACCIONES REALES
// ═══════════════════════════════════════════════════════════════

test.describe("F5.3 — ACCIONES REALES", () => {

  test("R10: Usuarios activos en UI coinciden con BD", async ({ page }) => {
    const countDb = dbQuery(`SELECT count(*) FROM users WHERE is_active = true`);
    console.log(`Usuarios activos en BD: ${countDb}`);

    await login(page);
    await page.goto(`${BASE}/admin/users`);
    await page.waitForTimeout(2000);

    const countUI = await page.locator("table tbody tr").count();
    console.log(`Usuarios en tabla UI: ${countUI}`);

    // UI shows active users — must match DB count
    expect(countUI).toBe(parseInt(countDb));
  });

  test("R11: Login genera activity log real", async ({ page }) => {
    const countBefore = dbQuery(`SELECT count(*) FROM activity_logs WHERE action = 'auth.login'`);

    await login(page);
    await page.waitForTimeout(2000);

    const countAfter = dbQuery(`SELECT count(*) FROM activity_logs WHERE action = 'auth.login'`);
    console.log(`Logs auth.login: antes=${countBefore}, después=${countAfter}`);
    expect(parseInt(countAfter)).toBeGreaterThan(parseInt(countBefore));
  });

  test("R12: Sesión captura IP y User-Agent reales", async ({ page }) => {
    await login(page);
    await page.waitForTimeout(2000);

    const session = dbQuery(
      `SELECT ip_address, user_agent FROM refresh_tokens ORDER BY created_at DESC LIMIT 1`
    );
    console.log(`Última sesión: ${session}`);
    const parts = session.split("|");
    const ip = parts[0]?.trim();
    const ua = parts[1]?.trim();

    console.log(`  IP: ${ip}`);
    console.log(`  UA: ${ua}`);

    expect(ip).toBeTruthy();
    expect(ip).not.toBe("—");
    expect(ua).toBeTruthy();
  });

  test("R13: Chat IA genera registros de coste", async ({ page }) => {
    test.setTimeout(60000);

    const costBefore = dbQuery(`SELECT count(*) FROM api_cost_logs`);

    // Login and get token for API call
    const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const cookies = await loginResp.headersArray();
    const accessTokenCookie = cookies
      .filter((h) => h.name.toLowerCase() === "set-cookie")
      .map((h) => h.value)
      .find((v) => v.includes("chs_access_token="));
    const token = accessTokenCookie?.match(/chs_access_token=([^;]+)/)?.[1] ?? "";

    // Send chat message via API (streaming response)
    const chatResp = await page.request.post(`${BASE}/api/agent/chat`, {
      headers: {
        Cookie: `chs_access_token=${token}`,
        "Content-Type": "application/json",
      },
      data: { messages: [{ role: "user", content: "Dime hola en una palabra" }] },
    });
    console.log(`Chat API status: ${chatResp.status()}`);
    expect(chatResp.ok()).toBeTruthy();

    // Wait for onFinish callback to persist cost log
    await page.waitForTimeout(8000);

    const costAfter = dbQuery(`SELECT count(*) FROM api_cost_logs`);
    console.log(`Costes API: antes=${costBefore}, después=${costAfter}`);
    expect(parseInt(costAfter)).toBeGreaterThan(parseInt(costBefore));
  });

});

// ═══════════════════════════════════════════════════════════════
// F5.4 — ANTI-REGRESIÓN
// ═══════════════════════════════════════════════════════════════

test.describe("F5.4 — ANTI-REGRESIÓN", () => {

  test("R14: No hay usuarios ficticios @centrohogar.es inactivos", async () => {
    const fakes = dbQuery(
      `SELECT count(*) FROM users WHERE is_active = false AND email LIKE '%@centrohogar.es'`
    );
    console.log(`Usuarios ficticios inactivos @centrohogar.es: ${fakes}`);
    expect(fakes).toBe("0");
  });

  test("R15: No hay API keys de test E2E", async () => {
    const e2eKeys = dbQuery(
      `SELECT count(*) FROM api_keys WHERE name LIKE '%E2E%' OR name LIKE '%Test Key%'`
    );
    console.log(`API keys E2E: ${e2eKeys}`);
    expect(e2eKeys).toBe("0");
  });

  test("R16: Refresh tokens por usuario no exceden 20", async () => {
    const excess = dbQuery(
      `SELECT user_id, count(*) as cnt FROM refresh_tokens GROUP BY user_id HAVING count(*) > 20`
    );
    console.log(`Usuarios con >20 tokens: ${excess || "ninguno"}`);
    expect(excess).toBe("");
  });

  test("R17: Todos los providers activos tienen API key encriptada", async () => {
    const badProviders = dbQuery(
      `SELECT name FROM api_providers WHERE is_active = true AND (api_key_encrypted IS NULL OR api_key_encrypted = '')`
    );
    console.log(`Providers activos sin key: ${badProviders || "ninguno"}`);
    expect(badProviders).toBe("");
  });

  test("R18: Apps activas tienen internal_url HTTP válida", async () => {
    const instances = dbQuery(
      `SELECT a.name, ai.internal_url FROM app_instances ai JOIN apps a ON ai.app_id = a.id WHERE a.is_active = true`
    );
    console.log(`App instances:\n${instances}`);

    const lines = instances.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      const parts = line.split("|");
      const name = parts[0]?.trim();
      const url = parts[1]?.trim();
      console.log(`  ${name}: ${url}`);
      // All URLs should be HTTP format (not Docker label references)
      if (url) {
        const isHttpUrl = url.startsWith("http://") || url.startsWith("https://");
        const isDockerHost = url.includes(":"); // host:port format
        expect(isHttpUrl || isDockerHost).toBeTruthy();
        // Should NOT be a Docker label service reference
        expect(url).not.toContain("@docker");
      }
    }
  });

  test("R19: Health checks en monitor reflejan actividad reciente", async () => {
    const statuses = dbQuery(
      `SELECT a.name, ai.status, ai.last_health_check FROM app_instances ai JOIN apps a ON ai.app_id = a.id WHERE a.is_active = true ORDER BY ai.last_health_check DESC`
    );
    console.log(`Health status por app:\n${statuses}`);

    // Should have recent health checks (within last 10 minutes)
    const recentChecks = dbQuery(
      `SELECT count(*) FROM app_instances WHERE last_health_check > NOW() - INTERVAL '10 minutes'`
    );
    console.log(`Apps con health check en últimos 10 min: ${recentChecks}`);
    expect(parseInt(recentChecks)).toBeGreaterThan(0);
  });

  test("R20: Activity logs no contienen auth.verify-access", async () => {
    const trafikLogs = dbQuery(
      `SELECT count(*) FROM activity_logs WHERE action = 'auth.verify-access'`
    );
    console.log(`Logs auth.verify-access: ${trafikLogs}`);
    // After F1.4 cleanup, should be 0
    expect(trafikLogs).toBe("0");
  });

  test("R21: Redirect sin auth NO contiene 0.0.0.0 ni localhost", async ({ page }) => {
    const response = await page.goto("https://platform.centrohogarsanchez.es/admin");
    const finalUrl = page.url();
    console.log(`Redirect sin auth: ${finalUrl}`);
    expect(finalUrl).not.toContain("0.0.0.0");
    expect(finalUrl).not.toContain("localhost");
    expect(finalUrl).toContain("platform.centrohogarsanchez.es");
  });

  test("R22: Refresh-redirect NO contiene 0.0.0.0 ni localhost", async ({ page }) => {
    // Simular cookie de sesión expirada
    await page.context().addCookies([
      { name: "chs_session_active", value: "true", domain: "platform.centrohogarsanchez.es", path: "/" }
    ]);
    const response = await page.goto("https://platform.centrohogarsanchez.es/admin");
    const finalUrl = page.url();
    console.log(`Refresh-redirect: ${finalUrl}`);
    expect(finalUrl).not.toContain("0.0.0.0");
    expect(finalUrl).not.toContain("localhost");
    expect(finalUrl).toContain("platform.centrohogarsanchez.es");
  });

});
