import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', e => console.log('ERROR:', e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(4000);

// screenshot หน้าหลัก
await page.screenshot({ path: 'D:/water_t2b/live_home.png', fullPage: false });
const body = await page.locator('body').innerText();
console.log(body.slice(0, 400));

// เปิด Devices page
await page.click('button:has-text("Devices")');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'D:/water_t2b/live_devices.png', fullPage: true });

await browser.close();
