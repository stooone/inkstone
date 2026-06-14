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
    const url = req.url();
    if (url.includes('/assets/')) {
      console.log(`REQ: ${url}`);
    }
  });

  page.on('response', res => {
    const url = res.url();
    if (url.includes('/assets/')) {
      console.log(`RES: ${url} -> Status ${res.status()}`);
    }
  });

  try {
    console.log('Navigating to http://localhost:8082...');
    await page.goto('http://localhost:8082', { waitUntil: 'networkidle0' });
    
    console.log('Clicking "Lists" button...');
    await page.click('#btn-nav-lists');
    
    console.log('Waiting for HSK Level 1 checkbox...');
    await page.waitForSelector('#toggle-list-nhsk1', { timeout: 3000 });
    
    console.log('Enabling HSK Level 1 list via JS click...');
    await page.evaluate(() => {
      document.getElementById('toggle-list-nhsk1').click();
    });
    
    // Wait for the toggle loader to finish and assets to fetch
    await new Promise(r => setTimeout(r, 4000));

    console.log('Going back to index...');
    await page.click('#btn-nav-back');
    
    console.log('Clicking "Write" button...');
    await page.waitForSelector('#btn-write', { timeout: 3000 });
    await page.click('#btn-write');
    
    console.log('Waiting 5 seconds on TeachView to capture loop...');
    await new Promise(r => setTimeout(r, 5000));
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
    server.kill();
    console.log('Done.');
  }
})();
