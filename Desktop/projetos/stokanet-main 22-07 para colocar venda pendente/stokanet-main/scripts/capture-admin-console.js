const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  try {
    await page.goto('http://localhost:3000/dashboard/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'admin-page.png', fullPage: true }).catch(()=>{})
    const editButton = await page.locator('text=Editar').first();
    if (await editButton.count() > 0) {
      console.log('Clicking Editar button')
      await editButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('No Editar button found')
    }
  } catch (e) {
    console.error('Error navigating:', e);
  }
  await browser.close();
})();
