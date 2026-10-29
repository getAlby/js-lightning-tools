import { recoverPublicKey, Signature } from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { decode } from "light-bolt11-decoder";
import { X402Requirements } from "./utils";

// Client side of the x402 `exact` scheme on Bitcoin Lightning (`lnbtc`).
// Spec: https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_lnbtc.md

/** Supported `lnbtc` networks mapped to their BOLT11 currency prefix. */
const LNBTC_NETWORKS: Record<string, string> = {
  "lnbtc:000000000019d6689c085ae165831e93": "bc", // mainnet
  "lnbtc:000000000933ea01ad0ee984209779ba": "tb", // testnet
};

const HTTP_PROFILE = "http:1";
const CLOCK_SKEW_SECONDS = 60;
// BOLT11 default when the invoice has no `x` field
const DEFAULT_INVOICE_EXPIRY = 3600;

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

const textEncoder = new TextEncoder();
const sha256Hex = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

const fail = (reason: string, message: string): never => {
  throw new Error(`x402: ${reason}: ${message}`);
};

/** True for an x402 entry that offers `exact` payment on a Lightning network. */
export const isLnbtcRequirements = (e: X402Requirements | undefined) =>
  e?.scheme === "exact" &&
  typeof e.network === "string" &&
  e.network.startsWith("lnbtc:");

/** JCS (RFC 8785) for the binding object, which holds only strings, arrays and objects. */
const canonicalize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`,
      );
    return `{${entries.join(",")}}`;
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return fail(
    "invalid_exact_lnbtc_request_binding",
    `unsupported binding value ${String(value)}`,
  );
};

/** Raw content bytes of a fetch body, as they will be sent on the wire. */
const getBodyBytes = async (
  body: RequestInit["body"] | undefined,
): Promise<Uint8Array> => {
  if (body === undefined || body === null) return new Uint8Array();
  if (typeof body === "string") return textEncoder.encode(body);
  if (body instanceof URLSearchParams) {
    return textEncoder.encode(body.toString());
  }
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return new Uint8Array(await body.arrayBuffer());
  }
  // FormData gets a random multipart boundary and streams can only be read
  // once, so the body bytes cannot be known before sending.
  return fail(
    "invalid_exact_lnbtc_request_binding",
    "request body type cannot be bound; use a string, Blob, ArrayBuffer or URLSearchParams body",
  );
};

const getBoundHeaders = (params: unknown): string[] => {
  const p = params as { headers?: unknown } | null;
  if (
    !p ||
    typeof p !== "object" ||
    Object.keys(p).length !== 1 ||
    !Array.isArray(p.headers)
  ) {
    return fail(
      "invalid_exact_lnbtc_request_binding",
      "requestBindingParams must contain exactly `headers`",
    );
  }
  const names = p.headers as unknown[];
  names.forEach((name, i) => {
    if (
      typeof name !== "string" ||
      !/^[!#$%&'*+\-.^_`|~0-9a-z]+$/.test(name) ||
      name === "payment-signature" ||
      (i > 0 && (names[i - 1] as string) >= name)
    ) {
      fail(
        "invalid_exact_lnbtc_request_binding",
        "bound headers must be sorted, unique, lowercase header names",
      );
    }
  });
  return names as string[];
};

// fetch() upper-cases these methods before sending
const NORMALIZED_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "POST", "PUT"];

/** Request hash for the `http:1` request binding profile. */
export const computeHttpRequestHash = async (args: {
  url: string;
  method?: string;
  headers: Headers;
  body?: RequestInit["body"];
  boundHeaders: string[];
}): Promise<string> => {
  const method = args.method ?? "GET";
  const binding = {
    domain: `x402:exact:lnbtc:bolt11:${HTTP_PROFILE}`,
    method: NORMALIZED_METHODS.includes(method.toUpperCase())
      ? method.toUpperCase()
      : method,
    url: args.url,
    bodyHash: sha256Hex(await getBodyBytes(args.body)),
    headers: args.boundHeaders.map((name) => {
      const value = args.headers.get(name);
      if (value === null) {
        return { name, valueHash: sha256Hex(new Uint8Array([0])) };
      }
      if (!/^[\x20-\x7e]*$/.test(value)) {
        fail(
          "invalid_exact_lnbtc_request_binding",
          `header ${name} has a non-ASCII value`,
        );
      }
      const bytes = textEncoder.encode(value);
      const prefixed = new Uint8Array(bytes.length + 1);
      prefixed[0] = 1;
      prefixed.set(bytes, 1);
      return { name, valueHash: sha256Hex(prefixed) };
    }),
  };
  return sha256Hex(textEncoder.encode(canonicalize(binding)));
};

/** 5-bit words to bytes, keeping a trailing partial byte (BOLT11 signing data). */
const wordsToBytes = (words: number[]): Uint8Array => {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const word of words) {
    acc = (acc << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  if (bits > 0) bytes.push((acc << (8 - bits)) & 0xff);
  return new Uint8Array(bytes);
};

/** Recover the compressed public key that signed a (checksum-valid) BOLT11 invoice. */
const recoverInvoiceSigner = (paymentRequest: string): string => {
  const pr = paymentRequest.toLowerCase();
  const separator = pr.lastIndexOf("1");
  const hrp = pr.slice(0, separator);
  const words = [...pr.slice(separator + 1, -6)].map((c) =>
    BECH32_CHARSET.indexOf(c),
  );
  const signedWords = words.slice(0, -104);
  const signature = wordsToBytes(words.slice(-104));
  const message = new Uint8Array([
    ...textEncoder.encode(hrp),
    ...wordsToBytes(signedWords),
  ]);
  return bytesToHex(
    recoverPublicKey(
      sha256(message),
      Signature.fromCompact(signature.slice(0, 64)),
      signature[64],
      true,
    ),
  );
};

/**
 * Validate an `exact`/`lnbtc` payment requirement against the request we are
 * about to send, following the spec's "Client Payment Construction" checks.
 * Throws when any check fails, so an invoice is never paid unless it is
 * signed by `payTo` and commits to this exact request.
 */
export const validateLnbtcRequirements = async (args: {
  requirements: X402Requirements;
  resourceUrl: unknown;
  url: string;
  fetchArgs: RequestInit;
  headers: Headers;
}): Promise<void> => {
  const { requirements: r, fetchArgs, headers } = args;
  const extra = r.extra ?? ({} as X402Requirements["extra"]);

  const currency = LNBTC_NETWORKS[r.network];
  if (!currency) fail("unsupported_network", r.network);
  if (r.asset !== "BTC") fail("invalid_exact_lnbtc_asset", String(r.asset));
  if (typeof r.amount !== "string" || !/^[1-9][0-9]*$/.test(r.amount)) {
    fail("invalid_exact_lnbtc_amount", String(r.amount));
  }
  if (
    typeof r.maxTimeoutSeconds !== "number" ||
    !Number.isInteger(r.maxTimeoutSeconds) ||
    r.maxTimeoutSeconds <= 0
  ) {
    fail("invalid_exact_lnbtc_max_timeout", String(r.maxTimeoutSeconds));
  }
  if (typeof r.payTo !== "string" || !/^0[23][0-9a-f]{64}$/.test(r.payTo)) {
    fail("invalid_exact_lnbtc_pay_to_malformed", String(r.payTo));
  }
  if (extra.paymentFlow !== "upfront") {
    fail("invalid_exact_lnbtc_payment_flow", String(extra.paymentFlow));
  }
  if (
    extra.assetTransferMethod !== undefined &&
    extra.assetTransferMethod !== "bolt11"
  ) {
    fail(
      "invalid_exact_lnbtc_asset_transfer_method",
      String(extra.assetTransferMethod),
    );
  }
  if (typeof extra.invoice !== "string" || !extra.invoice) {
    fail("invalid_exact_lnbtc_invoice_missing", "extra.invoice is empty");
  }

  // Request binding: only HTTP is supported by fetch402.
  if (extra.requestBindingProfile !== HTTP_PROFILE) {
    fail(
      "invalid_exact_lnbtc_request_binding",
      `unsupported request binding profile ${String(extra.requestBindingProfile)}`,
    );
  }
  if (
    typeof extra.requestHash !== "string" ||
    !/^[0-9a-f]{64}$/.test(extra.requestHash)
  ) {
    fail("invalid_exact_lnbtc_request_binding", "malformed requestHash");
  }
  const url = new URL(args.url);
  if (url.username || url.password || url.hash) {
    fail(
      "invalid_exact_lnbtc_request_binding",
      "url must not contain user information or a fragment",
    );
  }
  if (args.resourceUrl !== url.href) {
    fail(
      "invalid_exact_lnbtc_request_binding",
      `resource url ${String(args.resourceUrl)} does not match request url ${url.href}`,
    );
  }
  const requestHash = await computeHttpRequestHash({
    url: url.href,
    method: fetchArgs.method,
    headers,
    body: fetchArgs.body,
    boundHeaders: getBoundHeaders(extra.requestBindingParams),
  });
  if (requestHash !== extra.requestHash) {
    fail(
      "invalid_exact_lnbtc_request_mismatch",
      "requestHash does not match the request being sent",
    );
  }

  // Strict invoice checks. decode() validates the bech32 checksum.
  let sections: { name: string; value?: unknown }[];
  let payee: string;
  try {
    sections = decode(extra.invoice as string).sections as typeof sections;
    payee = recoverInvoiceSigner(extra.invoice as string);
  } catch (e) {
    return fail("invalid_exact_lnbtc_invoice_decode_failed", String(e));
  }
  const section = (name: string) => sections.filter((s) => s.name === name);

  const descriptionHashes = section("description_hash");
  if (descriptionHashes.length !== 1 || section("description").length) {
    fail(
      "invalid_exact_lnbtc_invoice_description",
      "invoice must contain exactly one description hash and no description",
    );
  }
  if (descriptionHashes[0].value !== requestHash) {
    fail(
      "invalid_exact_lnbtc_invoice_request_mismatch",
      "invoice description hash does not commit to this request",
    );
  }

  const payeeTag = section("payee");
  if (payee !== r.payTo || (payeeTag.length && payeeTag[0].value !== r.payTo)) {
    fail(
      "invalid_exact_lnbtc_invoice_payee_mismatch",
      `invoice signed by ${payee}, expected ${r.payTo}`,
    );
  }

  const invoiceCurrency = (
    section("coin_network")[0]?.value as {
      bech32?: string;
    }
  )?.bech32;
  if (invoiceCurrency !== currency) {
    fail(
      "invalid_exact_lnbtc_invoice_currency_mismatch",
      `invoice currency ${String(invoiceCurrency)} does not match ${r.network}`,
    );
  }

  if (section("amount")[0]?.value !== r.amount) {
    fail(
      "invalid_exact_lnbtc_invoice_amount_mismatch",
      `invoice amount ${String(section("amount")[0]?.value)} msat, expected ${r.amount}`,
    );
  }

  const timestamp = section("timestamp")[0]?.value as number;
  const expiry =
    (section("expiry")[0]?.value as number | undefined) ??
    DEFAULT_INVOICE_EXPIRY;
  if (expiry !== r.maxTimeoutSeconds) {
    fail(
      "invalid_exact_lnbtc_invoice_expiry_mismatch",
      `invoice expiry ${expiry}s, expected ${String(r.maxTimeoutSeconds)}s`,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (timestamp > now + CLOCK_SKEW_SECONDS) {
    fail(
      "invalid_exact_lnbtc_invoice_created_in_future",
      `invoice created at ${timestamp}`,
    );
  }
  if (now >= timestamp + expiry) {
    fail("invalid_exact_lnbtc_invoice_expired", "invoice has expired");
  }
};
