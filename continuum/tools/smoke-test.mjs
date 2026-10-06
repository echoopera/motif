// Optional health check: node tools/smoke-test.mjs <url>   (needs: npm i playwright-core, and CHROME=/path/to/chrome)
import { chromium, devices } from 'playwright-core';
const url = process.argv[2] || 'http://localhost:8000/';
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', r => errors.push('request failed: ' + r.url()));
await page.goto(url, { waitUntil: 'load' });
await page.tap('#enter'); await page.waitForTimeout(1800);
const box = await (await page.$('#stage')).boundingBox();
const cdp = await ctx.newCDPSession(page);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y }] });
await touch('touchStart', box.x + box.width * .25, box.y + box.height * .5);
for (let i = 1; i <= 25; i++) { await touch('touchMove', box.x + box.width * (.25 + i * .02), box.y + box.height * (.5 + Math.sin(i / 4) * .12)); await page.waitForTimeout(12); }
await touch('touchEnd');
await page.tap('#play'); await page.waitForTimeout(2500);
const state = await page.evaluate(() => ({ playing, audio: audio.a.state, route: path.length }));
await browser.close();
const ok = state.playing && state.audio === 'running' && state.route > 5 && !errors.length;
console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(state), errors.join('\n'));
process.exit(ok ? 0 : 1);
