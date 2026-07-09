import localforage from 'localforage';
import { check, Match } from '../store/meteor-mock';
import { CharacterData, assetForCharacter } from '/lib/characters';
import { assert, kHomePage, fetchUrl } from '/lib/base';

const kListColumns = [
  'simplified', 'traditional', 'numbered', 'pinyin', 'definition'];

// onAssetsLoaded is a callback that is executed when all required assets,
// such as the character data files, are saved to the asset store.
let onAssetsLoaded = null;
const kLoaded = new Promise((resolve, _) => onAssetsLoaded = resolve);

const base64 = {
  encode: (data) => {
    return btoa(encodeURIComponent(data).replace(
        /%([0-9A-F]{2})/g, (match, x) => String.fromCharCode('0x' + x)));
  },
};

// Input: a target filename and the data to download to it.
// Output: a Promise that resolves to a description of where to find the downloaded file.
const download = (filename, data) => {
  return new Promise((resolve, reject) => {
    try {
      const link = document.createElement('a');
      link.href = `data:text/plain;charset=utf-8;base64,${base64.encode(data)}`;
      link.download = filename;
      link.click();
      resolve('Downloads folder.');
    } catch (e) {
      reject(e);
    }
  });
}

const isImportedAsset = (asset) => {
  return asset.startsWith('characters/') || asset.startsWith('lists/custom.') || asset.startsWith('lists/manually.');
}

// Input: a path to an asset
// Output: a Promise that resolves to the String contents of that file
const readAsset = async (path) => {
  if (isImportedAsset(path)) {
    // Read from localForage cache for dynamic assets
    const data = await localforage.getItem('asset.' + path);
    if (data !== null) return data;
    
    // If it's a character and not in cache, we might need to fetch it from the homepage as a fallback
    if (path.startsWith('characters/')) {
      const charCode = path.substring('characters/'.length);
      const character = String.fromCodePoint(parseInt(charCode, 10));
      const fallbackUrl = `${kHomePage}/assets/characters/${charCode}`;
      try {
        const remoteData = await fetchUrl(fallbackUrl);
        // Cache it for future queries
        await localforage.setItem('asset.' + path, remoteData);
        return remoteData;
      } catch (err) {
        throw new Error(`Asset not found in local cache or fallback: ${path}`);
      }
    }
    
    throw new Error(`Asset not found: ${path}`);
  } else {
    // Read static assets from local Vite public/assets/ directory
    return fetchUrl(`./assets/${path}`);
  }
}

// In-memory cache of fully parsed character data objects
const characterCache = {};

// In-memory set of loaded group IDs to avoid refetching/re-parsing the group files
const loadedGroups = new Set();

// Input: a single Chinese character
const readCharacter = async (character) => {
  if (!character) throw new Error('No character provided.');
  
  // 1. Check in-memory cache first
  if (characterCache[character]) {
    return characterCache[character];
  }
  
  // 2. Check localForage for any customized/edited characters (which are written individually)
  const charCode = character.codePointAt(0);
  const cacheKey = `characters/${charCode}`;
  try {
    const customData = await localforage.getItem('asset.' + cacheKey);
    if (customData !== null) {
      const parsed = JSON.parse(customData);
      characterCache[character] = parsed;
      return parsed;
    }
  } catch (e) {
    console.error('Failed to read from localForage cache:', e);
  }
  
  // 3. Look up the group asset file for this character
  const groupAsset = assetForCharacter(character); // e.g. "characters_v2/78"
  const groupId = groupAsset.substring('characters_v2/'.length);
  
  // If we already loaded this group file, and it wasn't in cache, it means the character is missing from the group
  if (loadedGroups.has(groupId)) {
    throw new Error(`Character ${character} not found in loaded group file ${groupAsset}`);
  }
  
  // 4. Fetch and parse the group file
  try {
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
        console.error(`Failed to parse line in group asset ${groupAsset}:`, err);
      }
    }
    loadedGroups.add(groupId);
    
    // Now return the character if we found it in the parsed group
    if (characterCache[character]) {
      return characterCache[character];
    }
  } catch (err) {
    console.error(`Failed to fetch or parse group asset ${groupAsset}:`, err);
  }
  
  // 5. Final fallback to old URL if not found locally (in case local database is incomplete)
  const fallbackUrl = `${kHomePage}/assets/characters/${charCode}`;
  try {
    const remoteData = await fetchUrl(fallbackUrl);
    const parsed = JSON.parse(remoteData);
    characterCache[character] = parsed;
    // Cache it to localForage so we don't fetch it again
    await localforage.setItem('asset.' + cacheKey, remoteData);
    return parsed;
  } catch (err) {
    throw new Error(`Asset not found: ${character}`);
  }
};

// Input: an item, which includes a word and a list of lists it appears in
const readItem = (item, charset) => {
  if (!item || !item.word || item.lists.length === 0) {
    return Promise.reject(new Error(item));
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

// Input: the name of a list
const readList = (list) => {
  const assetPath = `lists/${list}.list`;
  // "manually" list is stored in localForage only (no static file)
  const assetPromise = (list === 'manually')
    ? readAsset(assetPath).catch(() => '')
    : readAsset(assetPath);
  return Promise.all([
    assetPromise,
    kCharacters,
  ]).then((resolutions) => {
    let [data, characters] = resolutions;
    // Strip UTF-8 BOM if present (some list files begin with \ufeff)
    if (data.charCodeAt(0) === 0xFEFF) data = data.slice(1);
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

// Input: a path and data to write to the asset at that path.
const writeAsset = async (path, data) => {
  if (!isImportedAsset(path)) {
    throw new Error(`Tried to write static asset: ${path}`);
  }
  await localforage.setItem('asset.' + path, data);
  return true;
}

// Deletes the given list and resolves when it is removed.
const removeList = (list) => {
  // Imported custom lists use the key format "custom.<timestamp>"
  // "manually" is a special built-in list that cannot be removed
  if (list === 'manually') {
    return Promise.reject(`Cannot remove the built-in "manually" list.`);
  }
  if (list.startsWith('custom.')) {
    const path = `lists/${list}.list`;
    return localforage.removeItem('asset.' + path);
  }
  // Static lists cannot be removed
  return Promise.reject(`Tried to remove static asset: ${list}`);
}

// Input: a character Object
const writeCharacter = (data) => {
  check(data, CharacterData);
  const path = `characters/${data.character.codePointAt(0)}`;
  return writeAsset(path, JSON.stringify(data));
}

// Input: a list of list-item objects with all the list column keys
const writeList = (list, items) => {
  return kCharacters.then((characters) => {
    const result = {count: 0, missing: {}};
    const rows = [];
    for (let item of items) {
      // numbered is optional; derive from pinyin (tone-marked → numbered) when missing
      if (!item.numbered && item.pinyin) {
        // Use pinyin value as-is for numbered; the pinyin field holds the real tone info
        item.numbered = item.pinyin;
      }
      const fields = kListColumns.map((column) => item[column]);
      const missing = kListColumns.filter((column) => !item[column]);
      // Require pinyin and definition; simplified or traditional (or both) must be present
      const requiredMissing = missing.filter((c) => c !== 'simplified' && c !== 'traditional');
      if (requiredMissing.length > 0) {
        console.warn(`Skipping malformed row: ${fields.join(', ')}. ` +
                     `Missing data for: ${requiredMissing.join(', ')}.`);
        continue;
      }
      if (!item.simplified && !item.traditional) {
        console.warn(`Skipping row with no characters: ${fields.join(', ')}.`);
        continue;
      }
      // Validate only the characters that are actually present
      const words = (item.simplified || '') + (item.traditional || '');
      if (!words.split('').every((x) => characters[x])) {
        Array.from(words).forEach(
            (x) => { if (!characters[x]) result.missing[x] = true; });
        continue;
      }
      const line = fields.join('\t');
      if (line.split('\t').length !== fields.length) {
        return Promise.reject(`Row contains tabs: ${fields.join(', ')}.`);
      }
      result.count += 1;
      rows.push(line);
    }
    if (rows.length === 0) return Promise.resolve(result);
    const data = rows.join('\n');
    return writeAsset(`lists/${list}.list`, data).then(() => result);
  });
}

// Compute two pieces of global data that can be loaded into memory once.
// kCharacters is a mapping from character to its current data version.

const kCharacters = readAsset('characters.txt').then((data) => {
  const characters = {};
  for (let line of data.split('\n')) {
    if (line.length === 0 || line[0] === '#') continue;
    if (line.length !== 1) throw new Error(`Unexpected line: ${line}`);
    characters[line] = (characters[line] || 0) + 1;
  }
  return characters;
}).catch((error) => {
  console.error('Failed to load characters.txt:', error);
  throw new Error(`Failed to load character data: ${error.message}`);
});

const kRadicals = readAsset('radicals.json')
    .then((data) => JSON.parse(data).radical_to_index_map)
    .catch((error) => console.error(error));

export {
  kCharacters,
  download,
  onAssetsLoaded,
  readCharacter,
  readItem,
  readList,
  removeList,
  writeCharacter,
  writeList,
};
