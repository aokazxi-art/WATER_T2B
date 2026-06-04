import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

// คลิกปุ่ม Devices
await page.click('button:has-text("Devices")');
await page.waitForTimeout(2000);

await page.screenshot({ path: 'D:/water_t2b/connection_screenshot.png', fullPage: true });

const body = await page.locator('body').innerText();
console.log('--- CONNECTION PAGE ---');
console.log(body.slice(0, 1000));
if (errors.length) { console.log('\n--- ERRORS ---'); errors.forEach(e => console.log(e)); }

await browser.close();
