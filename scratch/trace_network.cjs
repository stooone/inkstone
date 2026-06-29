const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

(async () => {
  console.log('Starting HTTP server...');
  const server = spawn('python3', ['-m', 'http.server', '8082'], { cwd: '/home/stone/Projects/inkstone/dist' });
  
  await new Promise(r => setTimeout(r, 1000));

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER LOG] [${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR] ${err.message}`);
    console.error(err.stack);
  });

  page.on('request', req => {
    // Only log assets or API calls to avoid spam
    const url = req.url();
    if (url.includes('/assets/') || url.endsWith('.js') || url.endsWith('.css') || url.includes('manifest')) {
      console.log(`REQ: ${url}`);
    }
  });

  page.on('requestfailed', req => {
    console.error(`REQ FAILED: ${req.url()} - ${req.failure().errorText}`);
  });

  page.on('response', res => {
    const url = res.url();
    if (url.includes('/assets/') || url.endsWith('.js') || url.endsWith('.css') || url.includes('manifest')) {
      console.log(`RES: ${url} -> Status ${res.status()}`);
    }
  });

  try {
    console.log('Navigating to http://localhost:8082...');
    await page.goto('http://localhost:8082', { waitUntil: 'load' });
    
    console.log('Clicking "Write" button...');
    await page.waitForSelector('#btn-write', { timeout: 3000 });
    await page.click('#btn-write');
    
    console.log('Waiting 5 seconds on TeachView...');
    await new Promise(r => setTimeout(r, 5000));
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
    server.kill();
    console.log('Done.');
  }
})();
