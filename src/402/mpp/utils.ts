export interface MppChallenge {
  id: string;
  realm: string;
  method: string;
  intent: string;
  request: string;
  expires?: string;
}

export interface MppChargeRequest {
  amount: string;
  currency: string;
  description?: string;
  recipient?: string;
  externalId?: string;
  methodDetails: {
    invoice: string;
    paymentHash?: string;
    network?: string;
  };
}

/**
 * Parse a `WWW-Authenticate: Payment …` header produced by a
 * draft-lightning-charge-00 server. Expected format:
 *
 *   Payment id="<id>", realm="<realm>", method="lightning",
 *           intent="charge", request="<base64url>" [, expires="<rfc3339>"]
 *
 * Returns null when the header is not a Payment lightning/charge challenge.
 */
export const parseMppChallenge = (header: string): MppChallenge | null => {
  if (!header.trimStart().toLowerCase().startsWith("payment")) {
    return null;
  }
  const rest = header
    .slice(header.toLowerCase().indexOf("payment") + "payment".length)
    .trim();
  const result: Record<string, string> = {};
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|([^,\s]*))/g;
  let match;
  while ((match = regex.exec(rest)) !== null) {
    result[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
  }

  if (
    result.method !== "lightning" ||
    result.intent !== "charge" ||
    !result.id ||
    !result.realm ||
    !result.request
  ) {
    return null;
  }

  return {
    id: result.id,
    realm: result.realm,
    method: result.method,
    intent: result.intent,
    request: result.request,
    ...(result.expires ? { expires: result.expires } : {}),
  };
};

/** Decode a base64url string (no padding required) to a UTF-8 string. */
export const decodeBase64url = (input: string): string => {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
};

/** Encode a UTF-8 string to base64url without padding. */
const encodeBase64url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

/**
 * JSON Canonicalization Scheme (RFC 8785).
 * Produces compact JSON with object keys sorted lexicographically.
 */
const jcs = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + (value as unknown[]).map(jcs).join(",") + "]";
  }
  const keys = Object.keys(value as object).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) + ":" + jcs((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
};

/**
 * Build the base64url-encoded credential token for the `Authorization` header.
 *
 * Per the spec the credential is a JCS-serialised JSON object that echoes all
 * challenge auth-params (id, realm, method, intent, request, expires) and
 * carries the HTLC preimage that proves payment:
 *
 *   {
 *     "challenge": { "id": "…", "intent": "charge",
 *                    "method": "lightning", "realm": "…", "request": "…" },
 *     "payload":   { "preimage": "<64-char lowercase hex>" }
 *   }
 *
 * Keys are sorted lexicographically at every level per JCS.
 */
export const buildMppCredential = (
  challenge: MppChallenge,
  preimage: string,
  source?: string,
): string => {
  const challengeEcho: Record<string, string> = {
    id: challenge.id,
    intent: challenge.intent,
    method: challenge.method,
    realm: challenge.realm,
    request: challenge.request,
  };
  if (challenge.expires) {
    challengeEcho.expires = challenge.expires;
  }

  const credential: Record<string, unknown> = {
    challenge: challengeEcho,
    payload: { preimage },
  };
  if (source) {
    credential.source = source;
  }

  return encodeBase64url(jcs(credential));
};

/**
 * Construct a `WWW-Authenticate` header for testing / server implementations.
 *
 * The auth scheme is `Payment` per [I-D.httpauth-payment].
 */
export const makeMppWwwAuthenticateHeader = (args: {
  id: string;
  realm: string;
  request: string;
  expires?: string;
}): string => {
  let header =
    `Payment id="${args.id}", realm="${args.realm}", method="lightning",` +
    ` intent="charge", request="${args.request}"`;
  if (args.expires) {
    header += `, expires="${args.expires}"`;
  }
  return header;
};

/** Encode an MppChargeRequest as a base64url string suitable for the `request` auth-param. */
export const encodeMppChargeRequest = (request: MppChargeRequest): string =>
  encodeBase64url(jcs(request));
