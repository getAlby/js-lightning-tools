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

export const makeL402AuthenticateHeader = (args: {
  macaroon: string;
  invoice: string;
  key?: string;
}) => {
  const key = args.key || "L402";

  return `${key} macaroon="${args.macaroon}", invoice="${args.invoice}"`;
};

export interface X402Requirements {
  scheme: string;
  network: string;
  extra: {
    invoice: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const buildX402PaymentSignature = (
  scheme: string,
  network: string,
  preimage: string,
  requirements: X402Requirements,
): string => {
  const json = JSON.stringify({
    x402Version: 2,
    scheme,
    network,
    payload: { preimage },
    accepted: requirements,
  });
  // btoa only handles latin1; encode via UTF-8 to be safe
  return btoa(unescape(encodeURIComponent(json)));
};
