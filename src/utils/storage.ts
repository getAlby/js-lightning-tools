export class MemoryStorage {
  storage;

  constructor(initial?: Record<string, unknown>) {
    this.storage = initial || {};
  }

  getItem(key: string) {
    return this.storage[key];
  }

  setItem(key: string, value: unknown) {
    this.storage[key] = value;
  }
}

export class NoStorage {
  constructor(initial?: unknown) {}

  getItem(key: string) {
    return null;
  }

  setItem(key: string, value: unknown) {}
}

export default MemoryStorage;
