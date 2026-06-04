import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
const errors = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => errors.push(err.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(5000);

await page.screenshot({ path: 'D:/water_t2b/app_screenshot.png', fullPage: true });

const title = await page.title();
const bodyText = await page.locator('body').innerText().catch(() => '(no body text)');

console.log('TITLE:', title);
console.log('\n--- BODY TEXT (first 800 chars) ---');
console.log(bodyText.slice(0, 800));
console.log('\n--- CONSOLE LOGS ---');
logs.forEach(l => console.log(l));
if (errors.length) { console.log('\n--- ERRORS ---'); errors.forEach(e => console.log(e)); }

await browser.close();
