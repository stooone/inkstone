import { PersistentDict } from '/client/model/persistence';

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

const lists = new PersistentDict('lists');

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
}

export { Lists };
