import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(3000);

// คลิก Pond A
await page.click('text=Pond A');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'D:/water_t2b/detail_page.png', fullPage: false });

// คลิกปุ่ม ดูรายวัน
await page.click('button:has-text("ดูรายวัน")');
await page.waitForTimeout(1000);
await page.screenshot({ path: 'D:/water_t2b/daily_chart.png', fullPage: false });

if (errors.length) { console.log('ERRORS:', errors); }
else console.log('No errors');

await browser.close();
