import { PersistentDict } from '/client/model/persistence';

const settings = new PersistentDict('settings');

const defaults = {
  canvas_width: 90,
  character_set: 'simplified',
  double_tap_speed: 500,
  max_adds: 20,
  max_reviews: 200,
  reveal_order: true,
  revisit_failures: true,
  show_regrading_icon: true,
  snap_strokes: true,
};

class Settings {
  static get(key) {
    const value = settings.get(key);
    return value === undefined ? defaults[key] : value;
  }
  static set(key, value) {
    settings.set(key, value);
  }
}

export { Settings };
