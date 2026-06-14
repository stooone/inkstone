import { PersistentDict } from '/client/model/persistence';

// Schema: assets is a map from data file names to versions of that file loaded.
const assets = new PersistentDict('assets');

class Assets {
  static getVersion(filename) {
    return (assets.get('data') || {})[filename] || 0;
  }
  static setVersion(filename, version) {
    const data = assets.get('data') || {};
    data[filename] = version;
    assets.set('data', data);
  }
}

export { Assets };
