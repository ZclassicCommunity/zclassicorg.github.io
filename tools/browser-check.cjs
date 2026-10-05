#!/usr/bin/env node
/* Optional development checks. The website itself does not need Node or npm. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const playwright = require('playwright');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const root = path.resolve(__dirname, '..');
const commands = 'git clone https://github.com/z23c/z23.git\ncd z23 && make setup && make -j z23\nbuild/bin/z23';
const release = 'https://github.com/ZclassicCommunity/zclassic/releases/download/v2.1.2-beta6/';
const wallets = {
  windows: release + 'zclwallet-v2.1.2-beta6-win64.exe',
  macos: release + 'zclwallet-v2.1.2-beta6-macos-arm64.dmg',
  linux: release + 'zclwallet-v2.1.2-beta6-linux-x86_64'
};
const types = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf'};
const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (pathname.startsWith('/preview/')) pathname = pathname.slice('/preview'.length);
  const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    response.end(content);
  });
});

const visibleWallets = page => page.locator('#wallet-download,.wallet-alternatives a').evaluateAll(elements =>
  elements.filter(element => element.getBoundingClientRect().height > 0).map(element => element.href));
const checkLayout = async page => {
  const result = await page.evaluate(() => {
    const grid = document.querySelector('.z23-main');
    const bounds = grid.getBoundingClientRect();
    const terminal = document.querySelector('.terminal').getBoundingClientRect();
    const copy = document.getElementById('copy-code').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      images: [...document.images].every(image => image.complete && image.naturalWidth > 0),
      z23Fits: [...grid.children].every(element => element.getBoundingClientRect().right <= bounds.right + 1),
      copyFits: copy.height === 0 || copy.right <= terminal.right,
      heroLabelsFit: [...document.querySelectorAll('.hero-actions .btn')].every(element => element.getBoundingClientRect().height <= 54)
    };
  });
  assert.equal(result.overflow, false, 'Page must reflow without horizontal overflow');
  assert.equal(result.images, true, 'Every page image must load');
  assert.equal(result.z23Fits, true, 'Z23 content must fit inside its grid');
  assert.equal(result.copyFits, true, 'The copy control must fit inside the terminal');
  assert.equal(result.heroLabelsFit, true, 'Hero button labels must fit on one line');
};

async function checkBrowser(name, url) {
  console.log(`Checking ${name}...`);
  const options = {headless: true};
  // An optional executable override makes the checks usable in container runtimes.
  if (name === 'chromium' && process.env.ZCL_CHROMIUM_EXECUTABLE) {
    options.executablePath = process.env.ZCL_CHROMIUM_EXECUTABLE;
    options.ignoreDefaultArgs = ['--enable-unsafe-swiftshader'];
    options.args = ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer', '--use-gl=disabled'];
  }
  const browser = await playwright[name].launch(options);
  const context = await browser.newContext({viewport: {width: 375, height: 812}, colorScheme: 'light', reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith(url) && /^https?:/.test(request.url())) externalRequests.push(request.url());
  });
  let checks = 0;
  const checked = () => checks++;
  try {
    await page.goto(url, {waitUntil: 'networkidle'});
    for (const width of [320, 375, 390, 480, 680, 768, 900, 901, 1024, 1440, 1920, 2400]) {
      await page.setViewportSize({width, height: 900});
      await checkLayout(page); checked();
    }

    for (const width of [375, 1440, 2400]) {
      await page.setViewportSize({width, height: 900});
      for (const id of ['discover', 'download', 'z23', 'specs', 'resources']) {
        await page.locator(`#${id}`).evaluate(element => element.scrollIntoView());
        await page.waitForFunction(id => document.querySelector(`#site-nav a[href="#${id}"]`).getAttribute('aria-current') === 'location', id);
      }
      checked();
    }

    for (const view of [{width: 375, theme: 'light'}, {width: 1440, theme: 'light'}, {width: 375, theme: 'dark'}, {width: 1440, theme: 'dark'}]) {
      await page.setViewportSize({width: view.width, height: 900});
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, view.theme);
      await page.evaluate(axe);
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']}
      })).violations.map(issue => ({id: issue.id, targets: issue.nodes.map(node => node.target)})));
      assert.deepEqual(violations, [], 'Automated accessibility findings'); checked();
    }

    await page.setViewportSize({width: 375, height: 812});
    await page.goto(url, {waitUntil: 'networkidle'});
    const smallTargets = await page.locator('button,input,.icon-btn,.back-top,.brand,.link-arrow,.cc0-badge-link,.node-downloads summary').evaluateAll(elements =>
      elements.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.height > 0 && (rect.height < 44 || rect.width < 44);
      }).map(element => element.id || element.className));
    assert.deepEqual(smallTargets, [], 'Controls and standalone action links need 44px targets'); checked();

    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark'); checked();
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark'); checked();
    await page.emulateMedia({colorScheme: 'light'});
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'Explicit choice must override the OS theme'); checked();
    const otherPage = await context.newPage();
    await otherPage.goto(url);
    await otherPage.evaluate(() => localStorage.setItem('zclassic-theme', 'light'));
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); checked();
    await otherPage.evaluate(() => localStorage.removeItem('zclassic-theme'));
    await page.emulateMedia({colorScheme: 'dark'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark'); checked();
    await otherPage.close();

    await page.locator('#menu-toggle').click();
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#discover'); checked();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle'); checked();
    await page.locator('#menu-toggle').click();
    await page.locator('#site-nav a[href="#resources"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'resources');
    assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false'); checked();
    await page.setViewportSize({width: 1440, height: 900});
    await page.locator('#site-nav a[href="#resources"]').focus();
    await page.setViewportSize({width: 375, height: 812});
    await page.waitForFunction(() => document.activeElement.id === 'menu-toggle'); checked();
    await page.setViewportSize({width: 1440, height: 900});
    await page.waitForFunction(() => document.activeElement.getAttribute('href') === '#discover'); checked();
    await page.setViewportSize({width: 375, height: 812});
    await page.goto(url);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main'); checked();

    for (const [platform, expected] of Object.entries(wallets)) {
      await page.locator(`#tab-${platform}`).click();
      assert.equal(await page.locator('#wallet-download').getAttribute('href'), expected);
      assert.equal(await page.locator(`#tab-${platform}`).getAttribute('aria-selected'), 'true'); checked();
    }
    await page.locator('#tab-linux').focus();
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-windows'); checked();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-linux'); checked();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#tab-linux').getAttribute('aria-selected'), 'true'); checked();

    const search = page.locator('#resource-search');
    await search.fill('Coinomi');
    assert.equal(await page.locator('.resource-group li:visible').count(), 1); checked();
    await page.locator('[data-filter="markets"]').click();
    assert.equal(await page.locator('#resource-empty').isVisible(), true); checked();
    await page.locator('#reset-resources').click();
    assert.equal(await page.locator('.resource-group li:visible').count(), 16);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'resource-search'); checked();
    await search.fill('unmatched resource');
    await search.press('Escape');
    assert.equal(await search.inputValue(), '');
    assert.equal(await page.locator('.resource-group li:visible').count(), 16); checked();
    await page.locator('[data-filter="markets"]').click();
    assert.equal(await page.locator('.resource-group li:visible').count(), 5); checked();
    await page.emulateMedia({media: 'print'});
    assert.equal(await page.locator('.resource-group li:visible').count(), 16);
    assert.equal(await page.locator('#resource-count').isVisible(), false); checked();
    await page.emulateMedia({media: 'screen'});

    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {writeText: async text => { window.copiedCommands = text; }}
    }));
    await page.locator('#copy-code').click();
    assert.equal(await page.evaluate(() => window.copiedCommands), commands); checked();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => { throw new Error('Permission denied'); }}});
      document.execCommand = () => { window.copiedCommands = document.querySelector('.clipboard-fallback').value; return true; };
    });
    await page.locator('#copy-code').click();
    assert.equal(await page.evaluate(() => window.copiedCommands), commands);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'copy-code'); checked();
    await page.evaluate(() => { document.execCommand = () => false; });
    await page.locator('#copy-code').click();
    assert.equal(await page.evaluate(() => getSelection().toString()), commands); checked();

    await page.goto(url + 'preview/', {waitUntil: 'networkidle'});
    await checkLayout(page); checked();
    const manifest = await (await context.request.get(url + 'preview/frontend-zcl/site.webmanifest')).json();
    for (const icon of manifest.icons) {
      const location = new URL(icon.src, url + 'preview/frontend-zcl/site.webmanifest').href;
      assert.equal((await context.request.get(location)).status(), 200); checked();
    }
    for (const asset of ['style.css', 'zclassic.png', 'zclassic.ico', 'cc0.png', 'frontend-zcl/favicon.svg', 'frontend-zcl/favicon.ico', 'frontend-zcl/favicon-96x96.png', 'frontend-zcl/apple-touch-icon.png']) {
      assert.equal((await context.request.get(url + asset)).status(), 200); checked();
    }
    assert.equal((await context.request.get(url + 'REVIEW_REPORT.md')).status(), 404); checked();
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, {waitUntil: 'load'});
    await checkLayout(page);
    assert.equal(await page.locator('#copy-code').isVisible(), true); checked();
    assert.deepEqual(errors, [], 'Unexpected JavaScript errors');
    assert.deepEqual(externalRequests, [], 'The page must not request third-party runtime assets'); checked();

    for (const failure of ['no-js', 'blocked-script', 'broken-script', 'blocked-storage']) {
      const fallback = await browser.newContext({viewport: {width: 375, height: 812}, javaScriptEnabled: failure !== 'no-js', reducedMotion: 'reduce'});
      if (failure === 'blocked-script') await fallback.route('**/frontend-zcl/app.js', route => route.abort());
      if (failure === 'broken-script') await fallback.route('**/frontend-zcl/app.js', route => route.fulfill({contentType: 'text/javascript', body: 'throw new Error("Simulated unavailable enhancement");'}));
      if (failure === 'blocked-storage') await fallback.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {get() { throw new Error('Storage blocked'); }});
      });
      const fallbackPage = await fallback.newPage();
      await fallbackPage.goto(url, {waitUntil: 'networkidle'});
      await checkLayout(fallbackPage);
      if (failure === 'blocked-storage') {
        await fallbackPage.locator('#theme-toggle').click();
        assert.equal(await fallbackPage.locator('html').getAttribute('data-theme'), 'dark');
      } else {
        assert.deepEqual(await visibleWallets(fallbackPage), Object.values(wallets));
        assert.equal(await fallbackPage.locator('#site-nav a:visible').count(), 5);
        assert.equal(await fallbackPage.locator('#theme-toggle').isVisible(), false);
        assert.equal(await fallbackPage.locator('.resource-controls').isVisible(), false);
      }
      checked();
      await fallback.close();
    }

    const motionPage = await context.newPage();
    await motionPage.emulateMedia({reducedMotion: 'no-preference'});
    await motionPage.goto(url);
    const motion = await motionPage.locator('.coin-float,.privacy-label,.rewards-label').evaluateAll(elements => elements.map(element => ({
      duration: parseFloat(getComputedStyle(element).animationDuration), iterations: getComputedStyle(element).animationIterationCount
    })));
    assert(motion.every(animation => animation.duration <= 5 && animation.iterations === '1'));
    await motionPage.emulateMedia({reducedMotion: 'reduce'});
    assert.equal(await motionPage.locator('.coin-float').evaluate(element => getComputedStyle(element).animationName), 'none'); checked();
    await motionPage.close();
    console.log(`PASS ${name}: ${checks} browser checks; no page overflow, runtime errors or external requests`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    for (const name of (process.env.ZCL_BROWSERS || 'chromium,firefox,webkit').split(',')) {
      assert(['chromium', 'firefox', 'webkit'].includes(name), 'Unknown browser engine');
      await checkBrowser(name, url);
    }
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
