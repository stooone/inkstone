const http = require('http');
const { spawn } = require('child_process');

(async () => {
  console.log('Starting HTTP server...');
  const server = spawn('python3', ['-m', 'http.server', '8082'], { cwd: '/home/stone/Projects/inkstone/dist' });
  
  await new Promise(r => setTimeout(r, 1000));

  const checkUrl = (path) => {
    return new Promise((resolve) => {
      http.get(`http://localhost:8082${path}`, (res) => {
        console.log(`GET ${path} -> Status: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve(data);
        });
      }).on('error', (err) => {
        console.error(`Error GET ${path}:`, err.message);
        resolve(null);
      });
    });
  };

  try {
    const listRes = await checkUrl('/assets/lists/demo.list');
    console.log('lists/demo.list sample:', listRes ? listRes.substring(0, 100) : 'null');

    const charRes = await checkUrl('/assets/characters_v2/78');
    console.log('characters_v2/78 sample:', charRes ? charRes.substring(0, 100) : 'null');
  } catch (e) {
    console.error(e);
  } finally {
    server.kill();
  }
})();
