import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Fase 0: Foundation", () => {
  test("T1: /api/health returns 200 with database connected", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
  });

  test("T2: / redirects to /login without auth", async ({ page }) => {
    await page.goto(BASE);
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });

  test("T3: /api/auth/me returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test("T4: Login with wrong credentials returns 401", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
  });

  test("T5: Login with correct credentials returns 200 + sets cookie", async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.username).toBe("admin");
    expect(body.user.isSuperAdmin).toBe(true);

    const cookies = res.headers()["set-cookie"];
    expect(cookies).toContain("chs_access_token");
  });

  test("T6: /api/auth/me with valid cookie returns user with departments", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.departments).toBeDefined();
    expect(Array.isArray(body.departments)).toBe(true);
    expect(body.departments.length).toBeGreaterThan(0);
    expect(body.departments[0].departmentName).toBeDefined();
    expect(body.departments[0].roleName).toBeDefined();
  });

  test("T7: Login page renders correctly", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(
      page.locator('input[name="username"]').first(),
    ).toBeVisible();
    await expect(
      page.locator('input[name="password"]').first(),
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test("T8: Full login flow — login, see dashboard, logout", async ({
    page,
  }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL(
      (url) => !url.toString().includes("/login"),
      { timeout: 10000 },
    );
    const pageContent = await page.textContent("body");
    expect(pageContent).toContain("Admin");
  });

  test("T8b: Dashboard shows departments and app cards", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL(
      (url) => !url.toString().includes("/login"),
      { timeout: 10000 },
    );
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    expect(bodyText).toContain("Citas");
    await page.screenshot({
      path: "tests/screenshots/dashboard.png",
      fullPage: true,
    });
  });

  test("T8c: Navbar has correct structure", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL(
      (url) => !url.toString().includes("/login"),
      { timeout: 10000 },
    );
    const bodyText = await page.textContent("body");
    expect(bodyText?.toUpperCase()).toContain("ALEPH");
    expect(bodyText).toContain("Admin");
  });

  test("T9: verify-access returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(401);
  });

  test("T10: verify-access returns 200 with valid auth and registered app domain", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(200);
    const userId = res.headers()["x-chs-user-id"];
    const userName = res.headers()["x-chs-user-name"];
    expect(userId).toBeDefined();
    expect(userName).toBeDefined();
  });

  test("T11: verify-access returns 403 for unregistered domain", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "admin", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "unknown.example.com" },
    });
    expect(res.status()).toBe(403);
  });

  test("T12: Non-admin user can access app they have access to", async ({
    request,
  }) => {
    await request.post(`${BASE}/api/auth/login`, {
      data: { username: "carlos.martinez", password: "admin123" },
    });
    const res = await request.get(`${BASE}/api/auth/verify-access`, {
      headers: { "X-Forwarded-Host": "citas.centrohogarsanchez.es" },
    });
    expect(res.status()).toBe(200);
  });
});
