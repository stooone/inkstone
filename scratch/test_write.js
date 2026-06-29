const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

(async () => {
  // Start server
  console.log('Starting HTTP server...');
  const server = spawn('python3', ['-m', 'http.server', '8082'], { cwd: '/home/stone/Projects/inkstone/dist' });
  
  // Wait a bit for server to spin up
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
  
  console.log('Navigating to http://localhost:8082...');
  await page.goto('http://localhost:8082', { waitUntil: 'networkidle0' });
  
  console.log('Clicking "Write" button...');
  await page.click('#btn-write');
  
  console.log('Waiting 5 seconds to observe behavior...');
  await new Promise(r => setTimeout(r, 5000));
  
  console.log('Closing browser and server...');
  await browser.close();
  server.kill();
  console.log('Done!');
})();
