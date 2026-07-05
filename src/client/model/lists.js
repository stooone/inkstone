import { PersistentDict } from '/client/model/persistence';
import { readList } from '/client/assets';
import { Settings } from '/client/model/settings';
import { Vocabulary } from '/client/model/vocabulary';

const kLists = {
  '100cr': {category: 'General', name: '100 Common Radicals'},
  'manually': {category: 'General', name: 'Manually added'},
  'nhsk1': {category: 'Hanyu Shuiping Kaoshi', name: 'HSK Level 1'},
  'nhsk2': {category: 'Hanyu Shuiping Kaoshi', name: 'HSK Level 2'},
  'nhsk3': {category: 'Hanyu Shuiping Kaoshi', name: 'HSK Level 3'},
  'nhsk4': {category: 'Hanyu Shuiping Kaoshi', name: 'HSK Level 4'},
  'nhsk5': {category: 'Hanyu Shuiping Kaoshi', name: 'HSK Level 5'},
  'nhsk6': {category: 'Hanyu Shuiping Kaoshi', name: 'HSK Level 6'},
};

// On first launch, before the user has enabled any lists, auto-enable HSK Level 1.
const enableDefaultList = (cache) => {
  if (!Object.keys(cache).some((key) => key.startsWith('status.'))) {
    lists.set('status.nhsk1', true);
  }
};

const lists = new PersistentDict('lists', enableDefaultList);

const getMatchingLists = (condition) => {
  const result = {};
  const all = Lists.getAllLists();
  Object.keys(all).filter(condition).forEach((x) => result[x] = all[x]);
  return result;
}

class Lists {
  static addList(list, metadata) {
    const all = Lists.getAllLists();
    all[list] = metadata;
    Lists.setAllLists(all);
  }
  static deleteList(list) {
    const all = Lists.getAllLists();
    if (!all[list] || kLists[list]) return;
    delete all[list];
    Lists.setAllLists(all);
  }
  static getAllLists() {
    const stored = lists.get('lists');
    if (!stored) return Object.assign({}, kLists);
    // Merge stored lists with kLists defaults so new built-in entries always appear
    return Object.assign({}, kLists, stored);
  }
  static getEnabledLists() {
    return getMatchingLists(Lists.isListEnabled);
  }
  static getImportedLists() {
    return getMatchingLists((list) => !kLists[list]);
  }
  static setAllLists(value) {
    lists.set('lists', value);
  }
  static disable(list) {
    lists.delete(`status.${list}`);
  }
  static enable(list) {
    lists.set(`status.${list}`, true);
  }
  static isListEnabled(list) {
    return lists.get(`status.${list}`);
  }

  static async loadEnabledLists() {
    const enabled = Object.keys(Lists.getEnabledLists());
    if (enabled.length === 0) return;

    const charset = Settings.get('character_set') || 'simplified';
    await Promise.all(enabled.map(async (listKey) => {
      try {
        const data = await readList(listKey);
        data.forEach((row) => {
          const word = row[charset];
          if (word) Vocabulary.addItem(word, listKey);
        });
      } catch (err) {
        console.error(`Failed to load enabled list ${listKey}:`, err);
      }
    }));
  }
}

export { Lists };
