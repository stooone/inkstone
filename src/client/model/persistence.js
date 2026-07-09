import localforage from 'localforage';
import { assert } from '/lib/base';
import { Tracker, ReactiveDict, Meteor } from '/src/store/meteor-mock';

const registry = {};
const loadPromises = [];

const clearTables = (tables, callback) => {
  const models = tables.map((key) => registry[key]);
  assert(models.every(x => x !== undefined), 'Some models to clear are unregistered');
  
  // Clear local caches and queues
  models.forEach((model) => model.clear());
  
  Tracker.afterFlush(() => {
    setTimeout(async () => {
      try {
        // Clear backing stores in localForage
        for (const table of tables) {
          const prefix = `table.${table}.`;
          const keys = await localforage.keys();
          const tableKeys = keys.filter((key) => key.startsWith(prefix));
          for (const key of tableKeys) {
            await localforage.removeItem(key);
          }
        }
        if (callback) callback();
      } catch (err) {
        console.error('Error clearing tables:', err);
      }
      window.location.reload();
    });
  });
}

const mockPersistenceLayer = async (replacement) => {
  // replacement is a mock key-value object
  Tracker.flush();
  
  try {
    // Clear localforage
    await localforage.clear();
    
    // Populate replacement values into localforage
    for (const key of Object.keys(replacement)) {
      await localforage.setItem(key, JSON.parse(replacement[key]));
    }
    
    // Reload all models
    for (const key of Object.keys(registry)) {
      await registry[key]._load();
    }
  } catch (err) {
    console.error('Error in mockPersistenceLayer:', err);
  }
}

class PersistentDict {
  constructor(name, onload) {
    this._name = name;
    this._onload = onload;
    this._cache = {};
    this._dirty = {};
    this._sentinel = new ReactiveDict();
    
    assert(!registry[name], `Model dictionary ${name} already registered`);
    registry[name] = this;

    const loadPromise = this._load();
    loadPromises.push(loadPromise);

    Tracker.autorun(() => this._save());
  }

  clear() {
    Object.keys(this._cache).forEach(this.delete.bind(this));
  }

  delete(key) {
    delete this._cache[key];
    this._dirty[key] = true;
    this._sentinel.set(key, !this._sentinel.get(key));
  }

  depend() {
    this._sentinel.allDeps.depend();
  }

  get(key) {
    this._sentinel.get(key);
    return this._cache[key];
  }

  keys() {
    this.depend();
    return Object.keys(this._cache);
  }

  set(key, value) {
    this._cache[key] = value;
    this._dirty[key] = true;
    this._sentinel.set(key, !this._sentinel.get(key));
  }

  async _load() {
    const prefix = `table.${this._name}.`;
    try {
      const keys = await localforage.keys();
      const ids = keys.filter((id) => id.startsWith(prefix));
      for (const id of ids) {
        const value = await localforage.getItem(id);
        const key = id.substr(prefix.length);
        this._cache[key] = value;
      }
      this._onload && this._onload(this._cache);
      this._dirty = {};
      this._sentinel.allDeps.changed();
    } catch (err) {
      console.error(`Error loading table ${this._name}:`, err);
    }
  }

  _save() {
    this.depend();
    setTimeout(async () => {
      const dirtyKeys = Object.keys(this._dirty);
      if (dirtyKeys.length === 0) return;

      const failedKeys = [];
      for (const key of dirtyKeys) {
        const id = `table.${this._name}.${key}`;
        try {
          if (this._cache.hasOwnProperty(key)) {
            await localforage.setItem(id, this._cache[key]);
          } else {
            await localforage.removeItem(id);
          }
        } catch (err) {
          console.error(`Error persisting key "${key}" for table "${this._name}":`, err);
          failedKeys.push(key);
        }
      }

      // Only clear dirty keys that were successfully saved.
      // Keys that failed will be retried on the next _save() cycle.
      if (failedKeys.length === dirtyKeys.length) {
        // All keys failed — keep the entire dirty set for retry.
        // Surface a storage error to the user if the underlying store is unavailable.
        if (dirtyKeys.length > 0 && typeof window !== 'undefined' && window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('inkstone-storage-error', {
            detail: { table: this._name, keyCount: dirtyKeys.length }
          }));
        }
        return;
      }
      for (const key of dirtyKeys) {
        if (!failedKeys.includes(key)) {
          delete this._dirty[key];
        }
      }
    });
  }
}

class PersistentVar {
  constructor(name) {
    this._dict = new PersistentDict(name);
  }
  get() {
    return this._dict.get('value');
  }
  set(value) {
    const clear = value === undefined;
    clear ? this._dict.delete('value') : this._dict.set('value', value);
  }
}

// Helper promise that resolves when all registered persistent dicts finish loading
const waitForDataLoad = () => Promise.all(loadPromises);

export { clearTables, mockPersistenceLayer, PersistentDict, PersistentVar, waitForDataLoad };