const fs = require('fs');
const path = require('path');

// Mock localforage
const localforage = {
  getItem: async (key) => null,
  setItem: async (key, val) => {}
};

// Mock base.js imports
const kHomePage = 'http://localhost:8082';
const fetchUrl = async (url) => '';

// Helpers from assets.js
const isImportedAsset = (asset) => {
  return asset.startsWith('characters/') || asset.startsWith('lists/s/');
}

const readAsset = async (assetPath) => {
  if (isImportedAsset(assetPath)) {
    return null;
  }
  const fullPath = path.join('/home/stone/Projects/inkstone/public/assets', assetPath);
  return fs.readFileSync(fullPath, 'utf8');
}

const assetForCharacter = (x) => `characters_v2/${Math.floor(x.charCodeAt(0) / 256)}`;

const kCharacters = readAsset('characters.txt').then((data) => {
  const characters = {};
  for (let line of data.split('\n')) {
    if (line.length === 0 || line[0] === '#') continue;
    if (line.length !== 1) throw new Error(`Unexpected line: ${line}`);
    characters[line] = (characters[line] || 0) + 1;
  }
  return characters;
});

const kRadicals = readAsset('radicals.json')
    .then((data) => JSON.parse(data).radical_to_index_map);

const characterCache = {};
const loadedGroups = new Set();

const readCharacter = async (character) => {
  if (!character) throw new Error('No character provided.');
  if (characterCache[character]) return characterCache[character];
  
  const groupAsset = assetForCharacter(character);
  const groupId = groupAsset.substring('characters_v2/'.length);
  
  if (loadedGroups.has(groupId)) {
    throw new Error(`Character ${character} not found in loaded group file ${groupAsset}`);
  }
  
  const groupContent = await readAsset(groupAsset);
  const lines = groupContent.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const data = JSON.parse(line);
      if (data && data.character) {
        characterCache[data.character] = data;
      }
    } catch (err) {
      console.error(`Failed to parse line:`, err);
    }
  }
  loadedGroups.add(groupId);
  
  if (characterCache[character]) {
    return characterCache[character];
  }
  throw new Error(`Asset not found: ${character}`);
};

const kListColumns = [
  'simplified', 'traditional', 'numbered', 'pinyin', 'definition'];

const readList = (list) => {
  return Promise.all([
    readAsset(`lists/${list}.list`),
    kCharacters,
  ]).then((resolutions) => {
    const [data, characters] = resolutions;
    const result = [];
    data.split('\n').forEach((line) => {
      const values = line.split('\t');
      if (values.length !== kListColumns.length) return;
      const row = {};
      kListColumns.forEach((column, i) => row[column] = values[i]);
      const words = row.simplified + row.traditional;
      if (!words.split('').every((x) => characters[x])) return;
      result.push(row);
    });
    return result;
  });
}

const readItem = (item, charset) => {
  if (!item || !item.word || item.lists.length === 0) {
    return Promise.reject(new Error(JSON.stringify(item)));
  }
  return Promise.all([
    readList(item.lists[0]),
    Promise.all(Array.from(item.word).map(readCharacter)),
    kRadicals,
  ]).then((resolutions) => {
    const [list, characters, radicals] = resolutions;
    const entries = list.filter((x) => x[charset] === item.word);
    if (entries.length === 0) throw new Error(`Entry not found: ${item.word}`);
    const entry = entries[0];
    entry.characters = characters;
    entry.word = item.word;
    const radical = radicals[item.word];
    if (radical && entry.characters.length === 1) {
      const base = entry.definition || entry.characters[0].definition || '';
      entry.definition = `${base}${base ? '; ' : ''}radical ${radical}`;
    }
    return entry;
  });
}

// Run the test for '中文' on the 'demo' list
(async () => {
  console.log('Testing readItem for word "中文" in list "demo"...');
  try {
    const item = { word: '中文', lists: ['demo'] };
    const res = await readItem(item, 'simplified');
    console.log('Success! Resulting item definition:', res.definition);
    console.log('Success! Character length:', res.characters.length);
  } catch (err) {
    console.error('Test failed with error:', err);
  }
})();
