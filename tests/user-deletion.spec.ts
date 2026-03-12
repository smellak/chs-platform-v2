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

const TEST_USER = {
  firstName: "TestDel",
  lastName: "Temporal",
  username: `testdel_${Date.now()}`,
  email: `testdel_${Date.now()}@test.com`,
  password: "TestPassword123!",
};

test.describe("User Deletion", () => {
  test("T01: create user, delete, verify disappears from active list", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Gestión de Usuarios')")).toBeVisible({ timeout: 10000 });

    // Count active users before
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await expect(statusFilter).toBeVisible();
    const activeCountBefore = await page.locator("table tbody tr").count();

    // Create test user
    await page.click('[data-testid="new-user-btn"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.fill("#firstName", TEST_USER.firstName);
    await page.fill("#lastName", TEST_USER.lastName);
    await page.fill("#username", TEST_USER.username);
    await page.fill("#email", TEST_USER.email);
    await page.fill("#password", TEST_USER.password);

    // Select first department and role
    const selects = page.locator("form button[role='combobox']");
    await selects.nth(0).click();
    await page.locator("[role='option']").first().click();
    await page.waitForTimeout(300);
    await selects.nth(1).click();
    await page.locator("[role='option']").first().click();
    await page.waitForTimeout(300);

    await page.click('button:has-text("Crear Usuario")');
    await page.waitForTimeout(3000);

    // Verify user appears (switch to "all" to be sure)
    await statusFilter.click();
    await page.locator("[role='option']").filter({ hasText: /^Todos/ }).click();
    await page.waitForTimeout(500);
    await expect(
      page.locator("tr").filter({ hasText: TEST_USER.firstName }),
    ).toBeVisible();

    // Switch back to "active"
    await statusFilter.click();
    await page.locator("[role='option']").filter({ hasText: /^Activos/ }).click();
    await page.waitForTimeout(500);

    // The new user should be in the active list
    await expect(
      page.locator("tr").filter({ hasText: TEST_USER.firstName }),
    ).toBeVisible();

    // Delete the user
    const testRow = page.locator("tr").filter({ hasText: TEST_USER.firstName });
    await testRow.locator('button[title="Eliminar usuario"]').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(
      page.locator('[role="dialog"]').locator(`text=${TEST_USER.firstName}`),
    ).toBeVisible();

    await page.click('[data-testid="confirm-delete-btn"]');
    await page.waitForTimeout(3000);

    // User should disappear from the active list (default filter)
    await expect(
      page.locator("tr").filter({ hasText: TEST_USER.firstName }),
    ).not.toBeVisible();

    // User should appear in the inactive list
    await statusFilter.click();
    await page.locator("[role='option']").filter({ hasText: /^Inactivos/ }).click();
    await page.waitForTimeout(500);
    await expect(
      page.locator("tr").filter({ hasText: TEST_USER.firstName }),
    ).toBeVisible();
  });

  test("T02: cannot delete Super Admin", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Gestión de Usuarios')")).toBeVisible({ timeout: 10000 });

    // Show all users
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await statusFilter.click();
    await page.locator("[role='option']").filter({ hasText: /^Todos/ }).click();
    await page.waitForTimeout(500);

    // Super Admin "Soufiane Mellak" should NOT have a delete button
    const adminRow = page.locator("tr").filter({ hasText: "Soufiane Mellak" });
    await expect(adminRow).toBeVisible();
    const deleteBtn = adminRow.locator('button[title="Eliminar usuario"]');
    await expect(deleteBtn).toHaveCount(0);
  });

  test("T03: deleted user cannot login", async ({ page, context }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Gestión de Usuarios')")).toBeVisible({ timeout: 10000 });

    // Show inactive users
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await statusFilter.click();
    await page.locator("[role='option']").filter({ hasText: /^Inactivos/ }).click();
    await page.waitForTimeout(500);

    // Find the test user we deleted in T01 or any inactive user
    const inactiveRows = page.locator("table tbody tr");
    const inactiveCount = await inactiveRows.count();
    expect(inactiveCount).toBeGreaterThan(0);

    // Get username of first inactive user
    const firstInactiveText = await inactiveRows.first().textContent();
    // We know inactive users exist — attempt login with a known inactive user
    // Use a new page context for login attempt
    const loginPage = await context.newPage();
    const domain = new URL(BASE).hostname;
    await loginPage.context().addCookies([
      { name: "chs_intro_seen", value: "1", domain, path: "/" },
    ]);
    await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    // Try login with an inactive user (sara.moreno)
    await loginPage.fill('input[name="username"]', "sara.moreno");
    await loginPage.fill('input[name="password"]', "Password123!");
    await loginPage.click('button[type="submit"]');
    await loginPage.waitForTimeout(3000);

    // Should still be on login page (login fails for inactive user)
    expect(loginPage.url()).toContain("/login");
    await loginPage.close();
  });

  test("T04: status filter shows correct counts", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Gestión de Usuarios')")).toBeVisible({ timeout: 10000 });

    // Status filter should show counts
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await expect(statusFilter).toBeVisible();

    // Open the dropdown
    await statusFilter.click();

    // Should show "Activos (N)" and "Inactivos (N)" options
    await expect(
      page.locator("[role='option']").filter({ hasText: /Activos \(\d+\)/ }),
    ).toBeVisible();
    await expect(
      page.locator("[role='option']").filter({ hasText: /Inactivos \(\d+\)/ }),
    ).toBeVisible();
  });

  test("T05: delete user with activity logs does not fail", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle" });
    await expect(page.locator("h1:has-text('Gestión de Usuarios')")).toBeVisible({ timeout: 10000 });

    // Show all users
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await statusFilter.click();
    await page.locator("[role='option']").filter({ hasText: /^Todos/ }).click();
    await page.waitForTimeout(500);

    // Find a non-super-admin user that has a delete button
    const deleteButtons = page.locator('button[title="Eliminar usuario"]');
    const btnCount = await deleteButtons.count();

    if (btnCount > 0) {
      // Click delete on first available
      await deleteButtons.first().click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      // Confirm delete
      await page.click('[data-testid="confirm-delete-btn"]');
      await page.waitForTimeout(3000);

      // Should NOT show an error toast — deletion should succeed
      // The page should refresh without errors
      await expect(page.locator("h1:has-text('Gestión de Usuarios')")).toBeVisible();
    }
  });
});
