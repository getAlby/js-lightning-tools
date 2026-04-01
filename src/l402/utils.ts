export interface KVStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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

/**
 * Client: parse "www-authenticate" header from server response
 * @param input
 * @returns details from the header value (token or macaroon, invoice)
 */
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

/**
 * Server: create a WWW-Authenticate header for a given macaroon and invoice
 * @param args the macaroon and invoice generated for the client's request
 * @returns the header value
 */
export const makeL402AuthenticateHeader = (args: {
  macaroon: string;
  invoice: string;
  key?: string;
}) => {
  const key = args.key || "L402";

  return `${key} macaroon="${args.macaroon}", invoice="${args.invoice}"`;
};

/**
 * @deprecated - use makeL402AuthenticateHeader
 */
export const makeAuthenticateHeader = makeL402AuthenticateHeader;

/**
 * Server: parse "authorization" header sent from client
 * @param input value from authorization header
 * @param key e.g. "L402"
 * @returns the macaroon and preimage
 */
export function parseL402Authorization(
  input: string,
  key = "L402",
): { macaroon: string; preimage: string } | null {
  if (!input.startsWith(key)) return null;
  const credentials = input.slice(key.length + " ".length);
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Invalid authorization header value");
  }
  return {
    macaroon: credentials.slice(0, colonIndex),
    preimage: credentials.slice(colonIndex + 1),
  };
}
