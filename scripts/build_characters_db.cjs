const fs = require('fs');
const path = require('path');
const https = require('https');

const DICTIONARY_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt';
const GRAPHICS_URL = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt';

const OUT_DIR = path.join(__dirname, '..', 'public', 'assets');
const CHARS_V2_DIR = path.join(OUT_DIR, 'characters_v2');

// ─── Decomposition implementation from src/lib/decomposition.js ───────────────────
const ids_data = {
  '⿰': {label: 'Left-to-right', arity: 2},
  '⿱': {label: 'Top-to-bottom', arity: 2},
  '⿴': {label: 'Surround', arity: 2},
  '⿵': {label: 'Surround-from-above', arity: 2},
  '⿶': {label: 'Surround-from-below', arity: 2},
  '⿷': {label: 'Surround-from-left', arity: 2},
  '⿸': {label: 'Surround-from-upper-left', arity: 2},
  '⿹': {label: 'Surround-from-upper-right', arity: 2},
  '⿺': {label: 'Surround-from-lower-left', arity: 2},
  '⿻': {label: 'Overlaid', arity: 2},
  '⿳': {label: 'Top-to-middle-to-bottom', arity: 3},
  '⿲': {label: 'Left-to-middle-to-right', arity: 3},
};
const UNKNOWN_COMPONENT = '？';

const augmentTreeWithPathData = (tree, path) => {
  tree.path = path;
  const children = (tree.children || []).length;
  for (let i = 0; i < children; i++) {
    augmentTreeWithPathData(tree.children[i], path.concat([i]));
  }
  return tree;
}

const parseSubtree = (decomposition, index) => {
  if (index[0] >= decomposition.length) {
    throw new Error(`Not enough characters in ${decomposition}.`);
  }
  const current = decomposition[index[0]];
  index[0] += 1;
  if (ids_data.hasOwnProperty(current)) {
    const result = {type: 'compound', value: current, children: []};
    for (let i = 0; i < ids_data[current].arity; i++) {
      result.children.push(parseSubtree(decomposition, index));
    }
    return result;
  } else if (current === UNKNOWN_COMPONENT) {
    return {type: 'character', value: '?'};
  }
  if (decomposition[index[0]] === '[') {
    index[0] += 3;
  }
  return {type: 'character', value: current};
}

const convertDecompositionToTree = (decomposition) => {
  const index = [0];
  decomposition = decomposition || UNKNOWN_COMPONENT;
  const result = parseSubtree(decomposition, index);
  if (index[0] !== decomposition.length) {
    throw new Error(`Too many characters in ${decomposition}.`);
  }
  return augmentTreeWithPathData(result, []);
}

// ─── Component calculation from server/characters.js ───────────────────
const computeComponents = (character, index, rows, result) => {
  result = result || {};
  result[character] = index;
  const data = rows[character];
  if (!data) throw new Error(`Computing component for ${character}.`);
  const match = data.matches[index];
  if (!match) return result;

  let node = convertDecompositionToTree(data.decomposition);
  for (let i of match) {
    if (!node.children) {
      node = null;
      break;
    }
    node = node.children[i];
  }
  if (!node || node.type !== 'character' || !rows[node.value]) {
    // Fallback: if matching failed, we just return the current result
    return result;
  }

  let child_index = 0;
  for (let i = 0; i < index; i++) {
    if (JSON.stringify(data.matches[i]) === JSON.stringify(match)) {
      child_index += 1;
    }
  }
  return computeComponents(node.value, child_index, rows, result);
}

const augmentRows = (all, rows) => {
  for (let character of all) {
    const row = rows[character];
    row.dependencies = {};
    if (row.decomposition) {
      Array.from(row.decomposition).map((x) => {
        if (ids_data[x] || x === '？') return;
        const data = rows[x];
        if (!data) return; // skip missing dependencies gracefully
        let value = data.definition || '(unknown)';
        if (data.pinyin && data.pinyin.length > 0) {
          value = data.pinyin.join(', ') + ' - ' + value;
        }
        row.dependencies[x] = value;
      });
    }
    if (row.strokes) {
      row.components = row.strokes.map(
        (x, i) => computeComponents(character, i, rows)
      );
    }
  }
}

// ─── Network downloader helper ───────────────────────────────────────────
const downloadFile = (url) => {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
        return;
      }
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
};

const assetForCharacter = (x) => `characters_v2/${Math.floor(x.charCodeAt(0) / 256)}`;

// ─── Main runner ─────────────────────────────────────────────────────────
(async () => {
  try {
    const dictText = await downloadFile(DICTIONARY_URL);
    const graphText = await downloadFile(GRAPHICS_URL);

    console.log('Parsing dictionary data...');
    const dictRows = {};
    dictText.split('\n').forEach(line => {
      if (!line.trim()) return;
      try {
        const row = JSON.parse(line);
        if (row.character) dictRows[row.character] = row;
      } catch(e) {}
    });

    console.log('Parsing graphics data...');
    const graphRows = {};
    graphText.split('\n').forEach(line => {
      if (!line.trim()) return;
      try {
        const row = JSON.parse(line);
        if (row.character) graphRows[row.character] = row;
      } catch(e) {}
    });

    console.log('Merging dictionary and graphics datasets...');
    const rows = {};
    const all = [];
    Object.keys(graphRows).forEach(char => {
      const dict = dictRows[char] || {};
      const graph = graphRows[char];
      const merged = { ...dict, ...graph };
      delete merged.normalized_medians;
      rows[char] = merged;
      all.push(char);
    });

    console.log('Augmenting components and dependencies...');
    augmentRows(all, rows);

    console.log(`Writing characters_v2 group files to ${CHARS_V2_DIR}...`);
    fs.mkdirSync(CHARS_V2_DIR, { recursive: true });

    const groups = {};
    all.forEach(char => {
      const groupAsset = assetForCharacter(char);
      const groupId = groupAsset.substring('characters_v2/'.length);
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(rows[char]);
    });

    Object.entries(groups).forEach(([groupId, charRows]) => {
      const filePath = path.join(CHARS_V2_DIR, groupId);
      const content = charRows.map(JSON.stringify).join('\n') + '\n';
      fs.writeFileSync(filePath, content, 'utf8');
    });

    console.log('Regenerating characters.txt...');
    const sortedChars = all.slice().sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
    fs.writeFileSync(path.join(OUT_DIR, 'characters.txt'), sortedChars.join('\n') + '\n', 'utf8');

    console.log('All character database files successfully merged, augmented, and saved!');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
