class MemoryStorage {
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

export default MemoryStorage;
