export class MemoryStorage {
  storage;

  constructor(initial?: any) {
    this.storage = initial || {};
  }

  getItem(key) {
    return this.storage[key];
  }

  setItem(key, value) {
    this.storage[key] = value;
  }
}

export class NoStorage {
  constructor(initial?: any) {
  }

  getItem(key) {
    return null;
  }

  setItem(key, value) {
  }
}

export default MemoryStorage;
