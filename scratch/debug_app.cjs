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
    console.log(`[CONSOLE] [${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR] ${err.message}`);
    console.error(err.stack);
  });

  try {
    console.log('Navigating to http://localhost:8082...');
    await page.goto('http://localhost:8082', { waitUntil: 'networkidle0' });
    
    console.log('Clicking "Write" button...');
    await page.waitForSelector('#btn-write', { timeout: 3000 });
    await page.click('#btn-write');
    
    console.log('Waiting 3 seconds on TeachView...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Current URL:', page.url());
  } catch (err) {
    console.error('Error during test execution:', err);
  } finally {
    await browser.close();
    server.kill();
    console.log('Test completed.');
  }
})();
