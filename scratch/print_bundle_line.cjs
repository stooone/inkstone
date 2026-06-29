const fs = require('fs');
const path = require('path');

const bundleDir = '/home/stone/Projects/inkstone/dist/assets';
const files = fs.readdirSync(bundleDir).filter(f => f.startsWith('index-') && f.endsWith('.js'));
if (files.length === 0) {
  console.error('No bundle file found.');
  process.exit(1);
}

const bundlePath = path.join(bundleDir, files[0]);
console.log('Reading bundle:', bundlePath);
const content = fs.readFileSync(bundlePath, 'utf8');

// The traceback said line 5 column 6931. Let's split by line and print line 5.
const lines = content.split('\n');
console.log(`Total lines: ${lines.length}`);
if (lines.length >= 5) {
  const line = lines[4]; // 0-indexed line 5 is index 4
  console.log(`Line 5 length: ${line.length}`);
  const start = Math.max(0, 6931 - 100);
  const end = Math.min(line.length, 6931 + 100);
  console.log(`Substr around 6931:\n... ${line.substring(start, end)} ...`);
} else {
  // If it's a single line or fewer lines
  const line = lines[0];
  const start = Math.max(0, 6931 - 100);
  const end = Math.min(line.length, 6931 + 100);
  console.log(`Substr around 6931 on line 1:\n... ${line.substring(start, end)} ...`);
}
