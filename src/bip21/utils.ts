import type { Bip21 } from "./types";

const BIP21_SCHEME = /^bitcoin:/i;

// BIP21 grammar: amountparam = "amount=" *digit [ "." *digit ]
// We require at least one digit on either side of the decimal point — this is
// slightly stricter than the spec ABNF but matches every real-world example
// (the spec shows "50", "50.00", "20.3"). Crucially this rejects scientific
// notation ("1e-3"), hex ("0x10"), commas, signs, and leading "+" / "-".
const BIP21_AMOUNT_RE = /^(\d+)(?:\.(\d+))?$/;

const SATS_PER_BTC = 100_000_000n;
const BTC_DECIMALS = 8;

/**
 * Convert a BIP21-compliant decimal BTC string to an integer number of
 * satoshis using exact decimal arithmetic (no floats). Fractional digits
 * beyond 8 are rounded half-up to the nearest satoshi.
 *
 * Assumes the input has already been validated against BIP21_AMOUNT_RE.
 */
const btcStringToSats = (btc: string): number => {
  const match = BIP21_AMOUNT_RE.exec(btc);
  if (!match) {
    // Should be unreachable — caller pre-validates.
    return Number.NaN;
  }
  const [, integerPart, rawFractional = ""] = match;

  let fractionalSats: bigint;
  if (rawFractional.length <= BTC_DECIMALS) {
    fractionalSats = BigInt(rawFractional.padEnd(BTC_DECIMALS, "0"));
  } else {
    // Round half-up at the satoshi boundary.
    const truncated = rawFractional.slice(0, BTC_DECIMALS);
    const roundDigit = rawFractional.charCodeAt(BTC_DECIMALS) - 48;
    fractionalSats = BigInt(truncated);
    if (roundDigit >= 5) fractionalSats += 1n;
  }

  const totalSats = BigInt(integerPart) * SATS_PER_BTC + fractionalSats;
  return Number(totalSats);
};

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
  if (typeof uri !== "string") {
    return null;
  }
  const normalized = uri.trim();
  if (!BIP21_SCHEME.test(normalized)) {
    return null;
  }

  const withoutScheme = normalized.replace(BIP21_SCHEME, "");
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

  if (params.amount !== undefined && BIP21_AMOUNT_RE.test(params.amount)) {
    result.amount = Number(params.amount);
    result.amountSats = btcStringToSats(params.amount);
  }
  if (params.label !== undefined) result.label = params.label;
  if (params.message !== undefined) result.message = params.message;
  if (params.lightning !== undefined) result.lightning = params.lightning;
  if (params.lno !== undefined) result.lno = params.lno;

  return result;
};

/** Returns true if the input starts with the `bitcoin:` URI scheme. */
export const isBip21 = (uri: string): boolean =>
  typeof uri === "string" && BIP21_SCHEME.test(uri.trim());
