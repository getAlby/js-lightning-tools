export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Wallet {
  payInvoice(args: { invoice: string }): Promise<{ preimage: string }>;
}

export class MemoryStorage implements KVStorage {
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

export class NoStorage implements KVStorage {
  constructor(initial?: unknown) {}

  getItem(key: string) {
    return null;
  }

  setItem(key: string, value: unknown) {}
}
