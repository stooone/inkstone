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
    this.stopped = false;
    this.invalidatedCallbacks = [];
    this._pendingTimer = null;
    this.run();
  }
  run() {
    if (this.stopped) return;
    this.invalidated = false;
    const previous = activeComputation;
    activeComputation = this;
    try {
      this.f(this);
    } finally {
      activeComputation = previous;
    }
  }
  stop() {
    this.stopped = true;
    this.invalidated = true;
    this.invalidatedCallbacks = [];
    if (this._pendingTimer !== null) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
  }
  onInvalidate(callback) {
    this.invalidatedCallbacks.push(callback);
  }
  invalidate() {
    if (this.invalidated || this.stopped) return;
    this.invalidated = true;
    this.invalidatedCallbacks.forEach((cb) => cb());
    this.invalidatedCallbacks = [];
    this._pendingTimer = setTimeout(() => this.run(), 0);
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

// Proper check/match implementation for type safety

class MatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'Match.Error';
    this.sanitizedError = new Error('Match failed');
    this.sanitizedError.name = 'Match.Error';
  }
}

const Where = class Where {
  constructor(f) { this.f = f; }
};

const Maybe = class Maybe {
  constructor(pattern) { this.pattern = pattern; }
};

const OneOf = class OneOf {
  constructor(patterns) { this.patterns = patterns; }
};

export const Match = {
  Error: MatchError,
  Where: (f) => new Where(f),
  Maybe: (p) => new Maybe(p),
  OneOf: (...patterns) => new OneOf(patterns),
  Integer: 'integer',
  Object: 'object'
};

export const check = (value, pattern) => {
  // Handle primitive type patterns
  if (pattern === String) {
    if (typeof value !== 'string') {
      throw new MatchError(`Expected string, got ${typeof value}`);
    }
    return true;
  }
  if (pattern === Number) {
    if (typeof value !== 'number') {
      throw new MatchError(`Expected number, got ${typeof value}`);
    }
    return true;
  }
  if (pattern === Object) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new MatchError(`Expected plain object, got ${typeof value}`);
    }
    return true;
  }
  if (pattern === Boolean) {
    if (typeof value !== 'boolean') {
      throw new MatchError(`Expected boolean, got ${typeof value}`);
    }
    return true;
  }
  if (pattern === undefined || pattern === null) {
    if (value !== undefined && value !== null) {
      throw new MatchError(`Expected undefined/null, got ${typeof value}`);
    }
    return true;
  }

  // Handle Match.Integer
  if (pattern === Match.Integer) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new MatchError(`Expected integer, got ${value}`);
    }
    return true;
  }

  // Handle Match.Object (plain object, not array/null)
  if (pattern === Match.Object) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new MatchError(`Expected plain object, got ${typeof value}`);
    }
    return true;
  }

  // Handle Match.Where custom validator
  if (pattern instanceof Where) {
    try {
      const result = pattern.f(value);
      if (!result) {
        throw new MatchError('Match.Where validation failed');
      }
      return true;
    } catch (e) {
      if (e instanceof MatchError) throw e;
      throw new MatchError('Match.Where validation failed');
    }
  }

  // Handle Match.Maybe (optional value)
  if (pattern instanceof Maybe) {
    if (value !== undefined) {
      return check(value, pattern.pattern);
    }
    return true;
  }

  // Handle Match.OneOf (union type)
  if (pattern instanceof OneOf) {
    for (const p of pattern.patterns) {
      try {
        return check(value, p);
      } catch (e) {
        // Try next pattern
      }
    }
    throw new MatchError('None of the OneOf patterns matched');
  }

  // Handle array patterns: [elementPattern]
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) {
      throw new MatchError(`Expected array, got ${typeof value}`);
    }
    if (pattern.length > 0) {
      for (const item of value) {
        check(item, pattern[0]);
      }
    }
    return true;
  }

  // Handle object patterns (schema validation)
  if (typeof pattern === 'object' && pattern !== null) {
    if (typeof value !== 'object' || value === null) {
      throw new MatchError(`Expected object, got ${typeof value}`);
    }
    for (const key of Object.keys(pattern)) {
      if (key in value) {
        check(value[key], pattern[key]);
      }
    }
    return true;
  }

  throw new Error(`Unknown check pattern: ${pattern}`);
};