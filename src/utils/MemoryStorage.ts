class MemoryStorage {
  storage: any;

  constructor(initial?: any) {
    this.storage = initial || {};
  }

  getItem(key: string) {
    return this.storage[key];
  }
  setItem(key: string, value: any) {
    this.storage[key] = value;
  }
}

export default MemoryStorage;
