const fs = require('fs');

try {
  const data = fs.readFileSync('/home/stone/Projects/inkstone/public/assets/characters.txt', 'utf8');
  const characters = {};
  for (let line of data.split('\n')) {
    if (line.length === 0 || line[0] === '#') continue;
    if (line.length !== 1) {
      console.log(`Error: Unexpected line length ${line.length} for line: "${line}" (hex: ${Buffer.from(line).toString('hex')})`);
      throw new Error(`Unexpected line: ${line}`);
    }
    characters[line] = (characters[line] || 0) + 1;
  }
  console.log('Parsed successfully! Total unique characters:', Object.keys(characters).length);
} catch (error) {
  console.error('Caught error during parse:', error.message);
}
