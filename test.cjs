const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console error: ${msg.text()}`);
    }
  });
  page.on('pageerror', error => {
    errors.push(`Page error: ${error.message}`);
  });
  
  await page.goto('http://localhost:8082', { waitUntil: 'networkidle0' });
  
  if (errors.length > 0) {
    console.error('Errors found:');
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log('No errors found on load.');
  }
  
  await browser.close();
})();
