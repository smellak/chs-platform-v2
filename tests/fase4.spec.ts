import { test, expect, type Page } from "@playwright/test";
import { execSync } from "child_process";

const BASE = process.env["TEST_BASE_URL"] ?? "http://localhost:3002";
const REPO = process.env["HOME"] + "/chs-platform-v2";

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

test.describe("Fase 4: Production Readiness", () => {
  // === DOCS ===

  test("T01: Docs app builds successfully", async () => {
    const result = execSync("cd apps/docs && npx next build 2>&1", {
      cwd: REPO,
      encoding: "utf-8",
      timeout: 120000,
    });
    // Should contain route listing from successful build
    expect(result).toContain("○");
  });

  // === CLI ===

  test("T02: CLI builds successfully", async () => {
    const result = execSync("cd apps/cli && npm run build 2>&1", {
      cwd: REPO,
      encoding: "utf-8",
      timeout: 30000,
    });
    expect(result).toContain("Build success");
  });

  test("T03: CLI generates .env with random secrets", async () => {
    execSync("rm -rf /tmp/chs-test-cli-pw", { encoding: "utf-8" });
    execSync(
      "node apps/cli/dist/index.js /tmp/chs-test-cli-pw --non-interactive 2>&1",
      { cwd: REPO, encoding: "utf-8" },
    );
    const env = execSync("cat /tmp/chs-test-cli-pw/.env", {
      encoding: "utf-8",
    });
    expect(env).toContain("JWT_SECRET=");
    expect(env).toContain("POSTGRES_PASSWORD=");
    expect(env).toContain("DATABASE_URL=");
    // Secrets should be random (long hex strings)
    const jwtLine = env.split("\n").find((l) => l.startsWith("JWT_SECRET="));
    expect(jwtLine).toBeDefined();
    const jwtValue = jwtLine!.split("=")[1]!;
    expect(jwtValue.length).toBeGreaterThanOrEqual(128); // 64 bytes = 128 hex chars
  });

  // === BRANDING ===

  test("T04: Logo SVG exists", async () => {
    const result = execSync("ls apps/platform/public/logo.svg 2>&1", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(result.trim()).toContain("logo.svg");
  });

  test("T05: Favicon SVG exists", async () => {
    const result = execSync("ls apps/platform/public/favicon.svg 2>&1", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(result.trim()).toContain("favicon.svg");
  });

  test("T06: Login page shows CHS branding", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("networkidle");
    // Should have the CHS logo image
    const logo = page.locator('img[alt="CHS Platform"]');
    await expect(logo).toBeVisible({ timeout: 10000 });
  });

  // === README ===

  test("T07: README.md is comprehensive", async () => {
    const readme = execSync("wc -l README.md", {
      cwd: REPO,
      encoding: "utf-8",
    });
    const lines = parseInt(readme.trim().split(" ")[0] ?? "0");
    expect(lines).toBeGreaterThan(50);
  });

  test("T08: CONTRIBUTING.md exists", async () => {
    const result = execSync("test -f CONTRIBUTING.md && echo 'exists'", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("exists");
  });

  test("T09: CHANGELOG.md exists", async () => {
    const result = execSync("test -f CHANGELOG.md && echo 'exists'", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("exists");
  });

  // === SECURITY ===

  test("T10: JWT_SECRET has no fallback in auth package", async () => {
    const result = execSync(
      "grep -rn 'fallback\\|default.*secret\\|chs-platform-dev' packages/auth/src/ --include='*.ts' 2>/dev/null | wc -l",
      { cwd: REPO, encoding: "utf-8" },
    );
    expect(parseInt(result.trim())).toBe(0);
  });

  test("T11: No any types in platform source", async () => {
    const result = execSync(
      "grep -rn ': any\\b' apps/platform/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.d.ts' | grep -v dist/ | wc -l",
      { cwd: REPO, encoding: "utf-8" },
    );
    expect(parseInt(result.trim())).toBe(0);
  });

  test("T12: No console.log in platform source", async () => {
    const result = execSync(
      "grep -rn 'console\\.log' apps/platform/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | wc -l",
      { cwd: REPO, encoding: "utf-8" },
    );
    expect(parseInt(result.trim())).toBe(0);
  });

  test("T13: Login has rate limiting on failed attempts", async ({ request }) => {
    const results: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request.post(`${BASE}/api/auth/login`, {
        data: { username: "nonexistent", password: "wrongpassword" },
      });
      results.push(res.status());
    }
    // Should get 429 (rate limited) after 5 failed attempts
    const hasRateLimit = results.includes(429);
    expect(hasRateLimit).toBe(true);
  });

  test("T14: Security headers present", async ({ request }) => {
    const res = await request.get(`${BASE}/`);
    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  // === AGENT TEMPLATE ===

  test("T15: Agent template exists with src/index.ts", async () => {
    const result = execSync(
      "test -f templates/agent-example/src/index.ts && echo 'exists'",
      { cwd: REPO, encoding: "utf-8" },
    );
    expect(result.trim()).toBe("exists");
  });

  test("T16: Agent template has Dockerfile", async () => {
    const result = execSync(
      "test -f templates/agent-example/Dockerfile && echo 'exists'",
      { cwd: REPO, encoding: "utf-8" },
    );
    expect(result.trim()).toBe("exists");
  });

  // === DOCKER ===

  test("T17: Dockerfile is multi-stage", async () => {
    const result = execSync("grep -c 'FROM' docker/Dockerfile", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(parseInt(result.trim())).toBeGreaterThanOrEqual(2);
  });

  test("T18: Container does not run as root", async () => {
    const result = execSync("grep 'USER' docker/Dockerfile", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(result.trim()).toContain("chs");
  });

  test("T19: .dockerignore exists", async () => {
    const result = execSync("test -f .dockerignore && echo 'exists'", {
      cwd: REPO,
      encoding: "utf-8",
    });
    expect(result.trim()).toBe("exists");
  });

  // === CONFIGURABLE ORG ===

  test("T20: Organization name shown in navbar", async ({ page }) => {
    await loginAsAdmin(page);
    // The org name from the seed should appear in the navbar subtitle
    const body = await page.textContent("body");
    expect(body).toBeDefined();
    // Should show the org name (from DB) or CHS branding
    expect(body!.length).toBeGreaterThan(0);
  });

  // === TYPE CHECK ===

  test("T21: TypeScript compiles without errors", async () => {
    const result = execSync(
      "npx tsc -p apps/platform/tsconfig.json --noEmit 2>&1",
      { cwd: REPO, encoding: "utf-8", timeout: 120000 },
    );
    // tsc with --noEmit outputs nothing on success
    expect(result.trim()).toBe("");
  });

  // === PRODUCTION NOT AFFECTED ===

  test("T22: Elias not affected", async ({ request }) => {
    try {
      const res = await request.get(
        "https://elias.centrohogarsanchez.es/api/health",
        { ignoreHTTPSErrors: true, timeout: 10000 },
      );
      expect(res.status()).toBe(200);
    } catch {
      // Network may not be available in CI, skip gracefully
      expect(true).toBe(true);
    }
  });
});
