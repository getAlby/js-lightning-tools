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

export const parseL402 = (input: string): Record<string, string> => {
  // Remove the L402 and LSAT identifiers
  const string = input.replace("L402", "").replace("LSAT", "").trim();

  // Initialize an object to store the key-value pairs
  const keyValuePairs = {};

  // Regular expression to match key and (quoted or unquoted) value
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|([^,]*))/g;
  let match;

  // Use regex to find all key-value pairs
  while ((match = regex.exec(string)) !== null) {
    // Key is always match[1]
    // Value is either match[3] (double-quoted), match[4] (single-quoted), or match[5] (unquoted)
    keyValuePairs[match[1]] = match[3] || match[4] || match[5];
  }

  return keyValuePairs;
};
