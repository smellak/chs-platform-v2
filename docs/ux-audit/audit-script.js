const { chromium } = require('playwright');

const BASE = 'https://platform.centrohogarsanchez.es';
const OUT = '/home/aleph/aleph-platform/docs/ux-audit';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input[name="username"]', { timeout: 10000 });
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--ignore-certificate-errors'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  
  // Collect all issues
  const issues = [];
  
  await login(page);
  
  // 1. Dashboard overview
  console.log('=== DASHBOARD ===');
  await page.screenshot({ path: `${OUT}/01-dashboard-overview.png`, fullPage: true });
  
  // 2. Check hero section stats
  const heroText = await page.textContent('.hero-gradient, [class*="hero"], [style*="gradient"]').catch(() => '');
  console.log('Hero text:', (heroText || '').substring(0, 200));
  
  // 3. Check each department card
  const deptCards = await page.locator('.app-card').all();
  console.log(`Found ${deptCards.length} department cards`);
  
  // List all department names
  for (let i = 0; i < deptCards.length; i++) {
    const text = await deptCards[i].textContent();
    console.log(`  Dept ${i}: "${text?.trim().substring(0, 80)}"`);
  }
  
  // 4. Click first department and analyze
  if (deptCards.length > 0) {
    const compras = page.locator('.app-card', { hasText: 'Compras' }).first();
    if (await compras.isVisible()) {
      await compras.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/02-dept-expanded-compras.png`, fullPage: true });
      
      // Check for back button using separate selectors
      let backBtnCount = 0;
      backBtnCount += await page.locator('text=Departamentos').count();
      backBtnCount += await page.locator('button:has-text("Volver")').count();
      backBtnCount += await page.locator('[aria-label*="back"]').count();
      console.log(`Back button elements found: ${backBtnCount}`);
      if (backBtnCount === 0) issues.push('BUG: No back button visible when viewing department apps');
      
      // Check app links - use separate locators
      const externalLinks = page.locator('a[href*="http"]');
      const linkCount = await externalLinks.count();
      console.log(`External links found: ${linkCount}`);
      for (let i = 0; i < linkCount; i++) {
        const href = await externalLinks.nth(i).getAttribute('href');
        const text = await externalLinks.nth(i).textContent();
        console.log(`  Link ${i}: text="${text?.trim()}" href="${href}"`);
      }
      
      // Check "Abrir" text links
      const abrirLinks = page.locator('text=Abrir');
      const abrirCount = await abrirLinks.count();
      console.log(`"Abrir" text elements found: ${abrirCount}`);
      
      // Try clicking an app "Abrir" link
      const abrirLink = page.locator('a:has-text("Abrir")').first();
      if (await abrirLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        const href = await abrirLink.getAttribute('href');
        console.log(`"Abrir" link href: ${href}`);
        if (!href || href === '#' || href === '') {
          issues.push('BUG: "Abrir" link has no valid href');
        }
      } else {
        issues.push('BUG: No "Abrir" link visible in expanded department');
      }
      
      // Screenshot individual app card
      const firstAppCard = page.locator('[class*="rounded"]').filter({ hasText: 'Citas' }).first();
      if (await firstAppCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstAppCard.screenshot({ path: `${OUT}/03-app-card-detail.png` });
      }
    }
  }
  
  // 5. Go back to dashboard
  console.log('\n=== BACK NAVIGATION ===');
  const backSelectors = [
    'text=\u2190 Departamentos',
    'button:has-text("Departamentos")',
    '[class*="back"]',
    'text=Volver',
    'a:has-text("Departamentos")',
  ];
  let foundBack = false;
  for (const sel of backSelectors) {
    const loc = page.locator(sel);
    if (await loc.count() > 0 && await loc.first().isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Found back option: "${await loc.first().textContent()}"`);
      await loc.first().click();
      await page.waitForTimeout(1000);
      foundBack = true;
      break;
    }
  }
  if (!foundBack) {
    console.log('No back button found, navigating to home...');
    issues.push('BUG: Cannot navigate back from department detail to department grid');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${OUT}/04-after-back.png`, fullPage: true });
  
  // 6. Test IT department (has most apps)
  console.log('\n=== IT DEPARTMENT ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const itCard = page.locator('.app-card', { hasText: 'IT' }).first();
  if (await itCard.isVisible()) {
    await itCard.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/05-dept-IT-expanded.png`, fullPage: true });
    
    // Count visible app cards
    const bodyText = await page.textContent('body');
    console.log('IT dept body has Citas:', bodyText?.includes('Citas'));
    console.log('IT dept body has Route:', bodyText?.includes('Route'));
    console.log('IT dept body has AON:', bodyText?.includes('AON'));
    
    // Check all "Abrir" links
    const abrirLinks = page.locator('a:has-text("Abrir")');
    const abrirCount = await abrirLinks.count();
    console.log(`"Abrir" anchor links in IT dept: ${abrirCount}`);
    for (let i = 0; i < abrirCount; i++) {
      const el = abrirLinks.nth(i);
      const href = await el.getAttribute('href');
      const tagName = await el.evaluate(e => e.tagName);
      console.log(`  Abrir[${i}]: tag=${tagName} href=${href}`);
      
      if (tagName === 'A' && href && href.startsWith('http')) {
        console.log(`    VALID external link: ${href}`);
      } else {
        issues.push(`BUG: Abrir link ${i} is not a valid external link (tag=${tagName}, href=${href})`);
      }
    }
    
    // Also check button-based Abrir
    const abrirBtns = page.locator('button:has-text("Abrir")');
    const abrirBtnCount = await abrirBtns.count();
    console.log(`"Abrir" button elements in IT dept: ${abrirBtnCount}`);
    for (let i = 0; i < abrirBtnCount; i++) {
      const text = await abrirBtns.nth(i).textContent();
      console.log(`  AbrirBtn[${i}]: text="${text?.trim()}"`);
    }
  } else {
    console.log('IT card not found');
  }
  
  // 7. Check search functionality
  console.log('\n=== SEARCH ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const searchInput = page.locator('input[type="text"], input[placeholder*="Buscar"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill('Citas');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/06-search-citas.png`, fullPage: true });
    const bodyAfterSearch = await page.textContent('body');
    if (!bodyAfterSearch?.includes('Citas')) {
      issues.push('BUG: Search for "Citas" does not show results');
    }
    console.log('Search results visible: body contains "Citas" =', bodyAfterSearch?.includes('Citas'));
  } else {
    console.log('Search input not found, trying command palette...');
  }
  
  // 8. Hover effects on department cards
  console.log('\n=== HOVER EFFECTS ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const firstDeptCard = page.locator('.app-card').first();
  if (await firstDeptCard.isVisible()) {
    await firstDeptCard.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/07-card-hover.png`, fullPage: true });
  }
  
  // 9. Monitor page
  console.log('\n=== MONITOR ===');
  await page.goto(`${BASE}/monitor`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/08-monitor.png`, fullPage: true });
  const monitorTitle = await page.title();
  console.log('Monitor page title:', monitorTitle);
  const monitorBody = await page.textContent('body');
  console.log('Monitor body preview:', monitorBody?.substring(0, 200));
  
  // 10. Profile page
  console.log('\n=== PROFILE ===');
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/09-profile.png`, fullPage: true });
  const profileBody = await page.textContent('body');
  console.log('Profile body preview:', profileBody?.substring(0, 200));
  
  // 11. Admin pages
  console.log('\n=== ADMIN ===');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/10-admin.png`, fullPage: true });
  const adminBody = await page.textContent('body');
  console.log('Admin body preview:', adminBody?.substring(0, 200));
  
  // 12. Dark mode
  console.log('\n=== DARK MODE ===');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const navButtons = page.locator('header button, nav button');
  const navBtnCount = await navButtons.count();
  console.log(`Nav buttons found: ${navBtnCount}`);
  let themeToggled = false;
  for (let i = 0; i < navBtnCount; i++) {
    const ariaLabel = await navButtons.nth(i).getAttribute('aria-label') || '';
    const innerHTML = await navButtons.nth(i).innerHTML();
    console.log(`  Nav button ${i}: aria="${ariaLabel}" html="${innerHTML.substring(0, 100)}"`);
    if (ariaLabel.includes('theme') || ariaLabel.includes('dark') || ariaLabel.includes('light') ||
        innerHTML.includes('Moon') || innerHTML.includes('Sun') || innerHTML.includes('moon') || innerHTML.includes('sun') ||
        innerHTML.includes('lucide-moon') || innerHTML.includes('lucide-sun')) {
      console.log(`  -> Clicking theme toggle at index ${i}`);
      await navButtons.nth(i).click();
      await page.waitForTimeout(1000);
      themeToggled = true;
      break;
    }
  }
  if (!themeToggled) {
    console.log('Theme toggle not found in nav buttons, trying all buttons...');
    const allBtns = page.locator('button');
    const allBtnCount = await allBtns.count();
    for (let i = 0; i < allBtnCount; i++) {
      const innerHTML = await allBtns.nth(i).innerHTML();
      if (innerHTML.includes('moon') || innerHTML.includes('sun') || innerHTML.includes('Moon') || innerHTML.includes('Sun') ||
          innerHTML.includes('theme') || innerHTML.includes('dark')) {
        console.log(`  Found theme toggle in all buttons at index ${i}`);
        await allBtns.nth(i).click();
        await page.waitForTimeout(1000);
        themeToggled = true;
        break;
      }
    }
  }
  await page.screenshot({ path: `${OUT}/11-dark-mode.png`, fullPage: true });
  
  // 13. Command palette
  console.log('\n=== COMMAND PALETTE ===');
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/12-cmd-palette.png` });
  // Check if command palette opened
  const dialogVisible = await page.locator('[role="dialog"], [class*="command"], [class*="palette"], [class*="modal"]').count();
  console.log(`Dialog/command palette elements visible: ${dialogVisible}`);
  await page.keyboard.press('Escape');
  
  // 14. Mobile viewport
  console.log('\n=== MOBILE ===');
  await page.close();
  const mobileCtx = await browser.newContext({ viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true, isMobile: true });
  const mobilePage = await mobileCtx.newPage();
  await login(mobilePage);
  await mobilePage.screenshot({ path: `${OUT}/13-mobile-dashboard.png`, fullPage: true });
  
  // Check mobile layout
  const mobileBody = await mobilePage.textContent('body');
  console.log('Mobile dashboard loaded, body length:', mobileBody?.length);
  
  // Click a department on mobile
  const mobileDept = mobilePage.locator('.app-card').first();
  if (await mobileDept.isVisible()) {
    await mobileDept.click();
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: `${OUT}/14-mobile-dept-expanded.png`, fullPage: true });
  }
  
  // Check mobile nav/hamburger menu
  const hamburger = mobilePage.locator('button[aria-label*="menu"], button[aria-label*="Menu"], [class*="hamburger"]');
  const hamburgerCount = await hamburger.count();
  console.log(`Mobile hamburger menu elements: ${hamburgerCount}`);
  if (hamburgerCount > 0) {
    await hamburger.first().click();
    await mobilePage.waitForTimeout(1000);
    await mobilePage.screenshot({ path: `${OUT}/14b-mobile-nav-open.png` });
  }
  
  await mobileCtx.close();
  
  // 15. Agent button
  console.log('\n=== AGENT BUTTON ===');
  const agentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const agentPage = await agentCtx.newPage();
  await login(agentPage);
  
  // Try multiple selectors for agent button
  const agentSelectors = [
    '[aria-label*="gente"]',
    '[aria-label*="Agent"]',
    '[aria-label*="agent"]',
    'button:has-text("Agente")',
    'button:has-text("Agent")',
    '[class*="agent"]',
    '[class*="chat"]',
    '[class*="assistant"]',
  ];
  let agentFound = false;
  for (const sel of agentSelectors) {
    const loc = agentPage.locator(sel).first();
    if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Found agent button with selector: ${sel}`);
      await loc.click();
      await agentPage.waitForTimeout(1500);
      await agentPage.screenshot({ path: `${OUT}/15-agent-panel.png` });
      agentFound = true;
      break;
    }
  }
  if (!agentFound) {
    console.log('Agent button not found with specific selectors, dumping all buttons...');
    const allButtons = await agentPage.locator('button').all();
    for (let i = 0; i < allButtons.length; i++) {
      const text = (await allButtons[i].textContent().catch(() => '')) || '';
      const ariaLabel = (await allButtons[i].getAttribute('aria-label').catch(() => '')) || '';
      const className = (await allButtons[i].getAttribute('class').catch(() => '')) || '';
      console.log(`  Button ${i}: text="${text.trim().substring(0, 40)}" aria="${ariaLabel}" class="${className.substring(0, 60)}"`);
    }
  }
  
  // 16. Check all page URLs and redirects
  console.log('\n=== URL ROUTING CHECK ===');
  const pagesToCheck = ['/dashboard', '/settings', '/apps', '/departments', '/users'];
  for (const path of pagesToCheck) {
    await agentPage.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
    await agentPage.waitForTimeout(1000);
    const finalUrl = agentPage.url();
    console.log(`  ${path} -> ${finalUrl}`);
    if (finalUrl.includes('/login')) {
      console.log(`    WARNING: ${path} redirected to login`);
    }
  }
  
  // 17. Check console errors
  console.log('\n=== CONSOLE ERRORS ===');
  const consoleErrors = [];
  agentPage.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  await agentPage.goto(BASE, { waitUntil: 'networkidle' });
  await agentPage.waitForTimeout(3000);
  console.log(`Console errors captured: ${consoleErrors.length}`);
  consoleErrors.forEach((err, i) => console.log(`  Error ${i}: ${err.substring(0, 150)}`));
  
  // 18. Full page DOM analysis
  console.log('\n=== DOM ANALYSIS ===');
  const htmlTag = await agentPage.locator('html').getAttribute('class') || '';
  const bodyClass = await agentPage.locator('body').getAttribute('class') || '';
  console.log(`HTML class: "${htmlTag}"`);
  console.log(`Body class: "${bodyClass}"`);
  
  // Check accessibility
  const imagesWithoutAlt = await agentPage.locator('img:not([alt])').count();
  const buttonsWithoutLabel = await agentPage.locator('button:not([aria-label]):not(:has-text(""))').count();
  console.log(`Images without alt: ${imagesWithoutAlt}`);
  console.log(`Buttons without aria-label or text: ${buttonsWithoutLabel}`);
  if (imagesWithoutAlt > 0) issues.push(`A11Y: ${imagesWithoutAlt} images without alt text`);
  
  await agentCtx.close();
  await browser.close();
  
  // Print all issues
  console.log('\n========================================');
  console.log('========== ISSUES FOUND ==========');
  console.log('========================================');
  issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
  console.log(`\nTotal issues: ${issues.length}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
