import { getNextInterval } from '/client/external/inkren/interval_quantifier';
import { PersistentDict } from '/client/model/persistence';
import { Tracker } from '/src/store/meteor-mock';

const kNumChunks = 16;

const kColumns = 'word last next lists attempts successes failed'.split(' ');
const kIndices = {};
kColumns.forEach((x, i) => kIndices[x] = i);

const is_active = (entry) =>
    entry[kIndices.lists].length > 0 &&
    !cache.blacklist[entry[kIndices.word]];

const onload = (value) => {
  cache.active = [];
  cache.blacklist = {};
  cache.chunks = [];
  cache.index = {};
  (value.blacklist || []).forEach((x) => cache.blacklist[x.word] = x);
  Array.from({length: kNumChunks}, (_, i) => i).forEach((i) => {
    cache.chunks.push(value[i] || []);
    cache.chunks[i].forEach((entry) => {
      cache.index[entry[kIndices.word]] = entry;
      if (is_active(entry)) cache.active.push(entry);
    });
  });
}

const cache = {active: [], blacklist: {}, chunks: [], index: {}};
const vocabulary = new PersistentDict('vocabulary', onload);

const chunk = (word) => cache.chunks[Math.abs(word.hash()) % kNumChunks];

const dirty = (word) => {
  const keys = word
    ? [Math.abs(word.hash()) % kNumChunks]
    : Array.from({length: kNumChunks}, (_, i) => i);
  keys.forEach((key) => vocabulary.set(key, cache.chunks[key]));
}

const materialize = (entry) => {
  const result = {};
  kColumns.forEach((x, i) => result[x] = entry[i]);
  return result;
}

class Cursor {
  constructor(filter, prioritizeManually = false) {
    vocabulary.depend();
    this._list = cache.active.filter(filter);
    this._prioritizeManually = prioritizeManually;
  }
  count() {
    return this._list.length;
  }
  fetch() {
    return this._list.map(materialize);
  }
  next() {
    let count = 0;
    let first = null;
    let result = null;
    let manualCount = 0;
    let manualResult = null;
    let manualFirst = null;

    for (let entry of this._list) {
      const next = entry[kIndices.next] || Infinity;
      const isManual = entry[kIndices.lists].includes('manually');

      if (!result || next < first) {
        count = 1;
        first = next;
        result = entry;
      } else if (next === first) {
        count += 1;
        if (count * Math.random() < 1) {
          result = entry;
        }
      }

      if (this._prioritizeManually && isManual) {
        if (!manualResult || next < manualFirst) {
          manualCount = 1;
          manualFirst = next;
          manualResult = entry;
        } else if (next === manualFirst) {
          manualCount += 1;
          if (manualCount * Math.random() < 1) {
            manualResult = entry;
          }
        }
      }
    }

    if (this._prioritizeManually && manualResult) {
      return materialize(manualResult);
    }
    return result && materialize(result);
  }
}

class Vocabulary {
  static addItem(word, list) {
    if (!cache.index[word]) {
      const entry = [word, null, null, [], 0, 0, false];
      chunk(word).push(entry);
      cache.index[word] = entry;
    }
    const entry = cache.index[word];
    const lists = entry[kIndices.lists];
    if (lists.indexOf(list) < 0) {
      lists.push(list);
      if (lists.length === 1 && is_active(entry)) cache.active.push(entry);
    }
    dirty(word);
  }
  static clearFailed(item) {
    const entry = cache.index[item.word];
    if (entry) entry[kIndices.failed] = false;
    dirty(item.word);
  }
  static dropList(list) {
    const updated = {active: [], chunks: Array.from({length: kNumChunks}, () => [])};
    cache.chunks.forEach((chunk, i) => chunk.forEach((entry) => {
      const lists = entry[kIndices.lists].filter((x) => x !== list);
      if (lists.length + entry[kIndices.attempts] > 0) {
        entry[kIndices.lists] = lists;
        updated.chunks[i].push(entry);
        if (is_active(entry)) updated.active.push(entry);
      } else {
        delete cache.index[entry[kIndices.word]];
      }
    }));
    cache.active = updated.active;
    cache.chunks = updated.chunks;
    dirty();
  }
  static getBlacklistedWords() {
    return vocabulary.get('blacklist');
  }
  static getExtraItems(last) {
    return new Cursor((entry) => {
      return entry[kIndices.attempts] === 0 || entry[kIndices.next] < last;
    });
  }
  static getFailuresInRange(start, end) {
    return new Cursor((entry) => {
      if (!entry[kIndices.failed]) return false;
      const last = entry[kIndices.last];
      return start <= last && last < end;
    });
  }
  static getItemsDueBy(last, next) {
    return new Cursor((entry) => {
      if (entry[kIndices.attempts] === 0) return false;
      return entry[kIndices.last] < last && entry[kIndices.next] < next;
    });
  }
  static getAllItems() {
    vocabulary.depend();
    return cache.active.map(materialize);
  }
  static getNewItems() {
    return new Cursor((entry) => entry[kIndices.attempts] === 0, true);
  }
  static updateBlacklist(item, blacklisted) {
    const word = item.word;
    if (!!blacklisted === !!cache.blacklist[word]) return;
    if (blacklisted) {
      cache.blacklist[word] = item;
      cache.active = cache.active.filter((x) => x[kIndices.word] !== word);
    } else {
      delete cache.blacklist[word];
      const entry = cache.index[word];
      if (entry && is_active(entry)) cache.active.push(entry);
    }
    const value = Object.keys(cache.blacklist).map((x) => cache.blacklist[x]);
    vocabulary.set('blacklist', value);
  }
  static updateItem(item, result, ts) {
    const entry = cache.index[item.word];
    if (!entry || entry[kIndices.attempts] !== item.attempts) return;

    entry[kIndices.last] = ts;
    entry[kIndices.next] = ts + getNextInterval(item, result, ts);

    const success = result < 3;
    entry[kIndices.attempts] = item.attempts + 1;
    entry[kIndices.successes] = item.successes + (success ? 1 : 0);
    entry[kIndices.failed] = !success;
    dirty(item.word);
  }
}

export { Vocabulary };
