import type { Bip21 } from "./types";

const BIP21_SCHEME = /^bitcoin:/i;

/**
 * Parse a BIP21 (`bitcoin:`) URI. Returns `null` if the input doesn't have the
 * `bitcoin:` scheme.
 *
 * The address is returned as-is (case preserved) — callers should validate it
 * separately if they need to ensure it's a well-formed bitcoin address.
 *
 * Per BIP21, parameters prefixed with `req-` are required: if the client
 * doesn't understand any of them, the payment MUST NOT be made. The unknown
 * required params are surfaced via `unknownRequiredParams` so callers can
 * decide how to fail.
 *
 * @example
 * parseBip21("bitcoin:bc1q...?amount=0.001&lightning=lnbc...")
 * // => { address: "bc1q...", amount: 0.001, amountSats: 100000, lightning: "lnbc...", ... }
 */
export const parseBip21 = (uri: string): Bip21 | null => {
  if (typeof uri !== "string" || !BIP21_SCHEME.test(uri)) {
    return null;
  }

  const withoutScheme = uri.replace(BIP21_SCHEME, "");
  const queryStart = withoutScheme.indexOf("?");
  const address =
    queryStart === -1 ? withoutScheme : withoutScheme.slice(0, queryStart);
  const query = queryStart === -1 ? "" : withoutScheme.slice(queryStart + 1);

  const params: Record<string, string> = {};
  const unknownRequiredParams: string[] = [];

  if (query) {
    // URLSearchParams handles decoding and repeated params; for BIP21 last-write-wins
    // is fine since the spec doesn't allow repeats.
    const search = new URLSearchParams(query);
    search.forEach((value, key) => {
      params[key] = value;
    });
  }

  const knownParams = new Set([
    "amount",
    "label",
    "message",
    "lightning",
    "lno",
  ]);

  for (const key of Object.keys(params)) {
    if (key.startsWith("req-") && !knownParams.has(key.slice(4))) {
      unknownRequiredParams.push(key);
    }
  }

  const result: Bip21 = {
    address: address.trim(),
    params,
    unknownRequiredParams,
  };

  if (params.amount !== undefined) {
    const amount = Number(params.amount);
    if (Number.isFinite(amount) && amount >= 0) {
      result.amount = amount;
      result.amountSats = Math.round(amount * 1e8);
    }
  }
  if (params.label !== undefined) result.label = params.label;
  if (params.message !== undefined) result.message = params.message;
  if (params.lightning !== undefined) result.lightning = params.lightning;
  if (params.lno !== undefined) result.lno = params.lno;

  return result;
};

/** Returns true if the input starts with the `bitcoin:` URI scheme. */
export const isBip21 = (uri: string): boolean =>
  typeof uri === "string" && BIP21_SCHEME.test(uri);
