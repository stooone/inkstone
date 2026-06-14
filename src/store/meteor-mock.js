// Lightweight replacement for Meteor's reactivity and core utilities.

let activeComputation = null;

export class Dependency {
  constructor() {
    this.dependents = new Set();
  }
  depend() {
    if (activeComputation) {
      this.dependents.add(activeComputation);
      activeComputation.onInvalidate(() => {
        this.dependents.delete(activeComputation);
      });
    }
  }
  changed() {
    const deps = Array.from(this.dependents);
    deps.forEach((comp) => comp.invalidate());
  }
}

class Computation {
  constructor(f) {
    this.f = f;
    this.invalidated = false;
    this.invalidatedCallbacks = [];
    this.run();
  }
  run() {
    this.invalidated = false;
    const previous = activeComputation;
    activeComputation = this;
    try {
      this.f(this);
    } finally {
      activeComputation = previous;
    }
  }
  onInvalidate(callback) {
    this.invalidatedCallbacks.push(callback);
  }
  invalidate() {
    if (this.invalidated) return;
    this.invalidated = true;
    this.invalidatedCallbacks.forEach((cb) => cb());
    this.invalidatedCallbacks = [];
    setTimeout(() => this.run(), 0);
  }
}

export const Tracker = {
  autorun(f) {
    return new Computation(f);
  },
  afterFlush(callback) {
    setTimeout(callback, 0);
  }
};

export class ReactiveVar {
  constructor(initialValue) {
    this.value = initialValue;
    this.dep = new Dependency();
  }
  get() {
    this.dep.depend();
    return this.value;
  }
  set(newValue) {
    if (this.value !== newValue) {
      this.value = newValue;
      this.dep.changed();
    }
  }
}

export class ReactiveDict {
  constructor(name) {
    this._name = name;
    this.values = {};
    this.deps = {};
    this.allDeps = new Dependency();
  }
  get(key) {
    if (!this.deps[key]) {
      this.deps[key] = new Dependency();
    }
    this.deps[key].depend();
    this.allDeps.depend();
    return this.values[key];
  }
  set(key, value) {
    if (this.values[key] !== value) {
      this.values[key] = value;
      if (!this.deps[key]) {
        this.deps[key] = new Dependency();
      }
      this.deps[key].changed();
      this.allDeps.changed();
    }
  }
  delete(key) {
    if (this.values.hasOwnProperty(key)) {
      delete this.values[key];
      if (this.deps[key]) {
        this.deps[key].changed();
      }
      this.allDeps.changed();
    }
  }
  clear() {
    const keys = Object.keys(this.values);
    this.values = {};
    keys.forEach((key) => {
      if (this.deps[key]) this.deps[key].changed();
    });
    this.allDeps.changed();
  }
}

export const Meteor = {
  startup(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb);
    } else {
      cb();
    }
  },
  defer(cb) {
    setTimeout(cb, 0);
  },
  setTimeout(cb, duration) {
    return setTimeout(cb, duration);
  },
  clearTimeout(id) {
    clearTimeout(id);
  },
  isCordova: false,
  isClient: true,
  isServer: false
};

// Mock check / Match framework from Meteor check package.
export const check = (value, pattern) => {
  return true; // No-op type safety check for porting compatibility.
};

export const Match = {
  Where: (f) => f,
  Maybe: (p) => p,
  Integer: 'integer',
  Object: 'object'
};
