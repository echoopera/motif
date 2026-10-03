// Loads showcase/index.html in headless Chromium, checks for console errors, that the canvas animates (frames differ) and screenshots it.
import path from 'node:path'; import fs from 'node:fs'; import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { chromium } = createRequire(path.join(root, 'sdk/package.json'))('playwright');
const browser = await chromium.launch({ executablePath: process.env.MOTIF_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push(String(e)));
await page.goto('file://' + path.join(root, 'showcase/index.html'));
await page.waitForFunction(() => document.querySelector('#ov') && !document.querySelector('#ov').classList.contains('on'), null, { timeout: 60000 });
const grab = () => page.evaluate(() => { const c = document.querySelector('#cv'); return c.toDataURL('image/png').length + ':' + c.toDataURL('image/png').slice(-200); });
const a = await grab(); await page.waitForTimeout(1500); const b = await grab();
console.log('animating:', a !== b, 'errors:', errs.length, errs.slice(0, 3));
// switch kit and style, check it prepares and draws
for (const [kit, st] of [['topological-tide', 'chrome-channels'], ['deconstruct-field', 'broken-axis']]) {
  await page.click(`.kit[data-kit="${kit}"]`); await page.click(`.sty[data-st="${st}"]`);
  await page.waitForFunction(() => !document.querySelector('#ov').classList.contains('on'), null, { timeout: 60000 });
  console.log('ok', kit, st, await page.textContent('#stName'));
}
await page.screenshot({ path: path.join(root, 'qa/showcase.png'), fullPage: false });
await browser.close();
