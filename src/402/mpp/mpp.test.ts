import fetchMock from "jest-fetch-mock";
import { fetchWithMpp } from "./mpp";
import {
  buildMppCredential,
  decodeBase64url,
  encodeMppChargeRequest,
  makeMppWwwAuthenticateHeader,
  MppChargeRequest,
  parseMppChallenge,
} from "./utils";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";
const PREIMAGE =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
const CHALLENGE_ID = "kM9xPqWvT2nJrHsY4aDfEb";
const REALM = "api.example.com";

const MPP_URL = "https://api.example.com/protected";

const CHARGE_REQUEST: MppChargeRequest = {
  amount: "10",
  currency: "sat",
  methodDetails: {
    invoice: INVOICE,
    network: "mainnet",
  },
};

const ENCODED_REQUEST = encodeMppChargeRequest(CHARGE_REQUEST);

function makeWallet(preimage: string = PREIMAGE) {
  return {
    payInvoice: jest.fn().mockResolvedValue({ preimage }),
  };
}

beforeEach(() => {
  fetchMock.resetMocks();
});

// ---------------------------------------------------------------------------
// parseMppChallenge
// ---------------------------------------------------------------------------
describe("parseMppChallenge", () => {
  test("parses a standard Payment header", () => {
    const header = makeMppWwwAuthenticateHeader({
      id: CHALLENGE_ID,
      realm: REALM,
      request: ENCODED_REQUEST,
    });
    const result = parseMppChallenge(header);
    expect(result).toEqual({
      id: CHALLENGE_ID,
      realm: REALM,
      method: "lightning",
      intent: "charge",
      request: ENCODED_REQUEST,
    });
  });

  test("parses optional expires field", () => {
    const expires = "2026-12-31T23:59:59Z";
    const header = makeMppWwwAuthenticateHeader({
      id: CHALLENGE_ID,
      realm: REALM,
      request: ENCODED_REQUEST,
      expires,
    });
    const result = parseMppChallenge(header);
    expect(result?.expires).toBe(expires);
  });

  test("returns null for non-Payment header (e.g. L402)", () => {
    expect(
      parseMppChallenge(`L402 macaroon="tok", invoice="${INVOICE}"`),
    ).toBeNull();
  });

  test("returns null for wrong method", () => {
    const header = `Payment id="${CHALLENGE_ID}", realm="${REALM}", method="onchain", intent="charge", request="${ENCODED_REQUEST}"`;
    expect(parseMppChallenge(header)).toBeNull();
  });

  test("returns null for wrong intent", () => {
    const header = `Payment id="${CHALLENGE_ID}", realm="${REALM}", method="lightning", intent="subscribe", request="${ENCODED_REQUEST}"`;
    expect(parseMppChallenge(header)).toBeNull();
  });

  test("returns null when id is missing", () => {
    const header = `Payment realm="${REALM}", method="lightning", intent="charge", request="${ENCODED_REQUEST}"`;
    expect(parseMppChallenge(header)).toBeNull();
  });

  test("returns null when realm is missing", () => {
    const header = `Payment id="${CHALLENGE_ID}", method="lightning", intent="charge", request="${ENCODED_REQUEST}"`;
    expect(parseMppChallenge(header)).toBeNull();
  });

  test("returns null when request is missing", () => {
    const header = `Payment id="${CHALLENGE_ID}", realm="${REALM}", method="lightning", intent="charge"`;
    expect(parseMppChallenge(header)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildMppCredential
// ---------------------------------------------------------------------------
describe("buildMppCredential", () => {
  test("produces a base64url-encoded JCS credential", () => {
    const challenge = {
      id: CHALLENGE_ID,
      realm: REALM,
      method: "lightning",
      intent: "charge",
      request: ENCODED_REQUEST,
    };
    const credential = buildMppCredential(challenge, PREIMAGE);

    // Must not contain base64 padding
    expect(credential).not.toMatch(/=/);
    // Must use base64url alphabet
    expect(credential).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = JSON.parse(decodeBase64url(credential));
    expect(decoded.challenge.id).toBe(CHALLENGE_ID);
    expect(decoded.challenge.realm).toBe(REALM);
    expect(decoded.challenge.intent).toBe("charge");
    expect(decoded.challenge.method).toBe("lightning");
    expect(decoded.challenge.request).toBe(ENCODED_REQUEST);
    expect(decoded.payload.preimage).toBe(PREIMAGE);
  });

  test("challenge keys are sorted lexicographically (JCS)", () => {
    const challenge = {
      id: CHALLENGE_ID,
      realm: REALM,
      method: "lightning",
      intent: "charge",
      request: ENCODED_REQUEST,
      expires: "2026-12-31T23:59:59Z",
    };
    const credential = buildMppCredential(challenge, PREIMAGE);
    const decoded = JSON.parse(decodeBase64url(credential));

    const challengeKeys = Object.keys(decoded.challenge);
    expect(challengeKeys).toEqual([...challengeKeys].sort());
  });

  test("top-level credential keys are sorted lexicographically (JCS)", () => {
    const challenge = {
      id: CHALLENGE_ID,
      realm: REALM,
      method: "lightning",
      intent: "charge",
      request: ENCODED_REQUEST,
    };
    const credential = buildMppCredential(challenge, PREIMAGE);
    const decoded = JSON.parse(decodeBase64url(credential));

    const topKeys = Object.keys(decoded);
    expect(topKeys).toEqual([...topKeys].sort());
  });

  test("includes optional source field when provided", () => {
    const challenge = {
      id: CHALLENGE_ID,
      realm: REALM,
      method: "lightning",
      intent: "charge",
      request: ENCODED_REQUEST,
    };
    const source = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";
    const credential = buildMppCredential(challenge, PREIMAGE, source);
    const decoded = JSON.parse(decodeBase64url(credential));
    expect(decoded.source).toBe(source);
  });

  test("includes optional expires in echoed challenge", () => {
    const expires = "2026-12-31T23:59:59Z";
    const challenge = {
      id: CHALLENGE_ID,
      realm: REALM,
      method: "lightning",
      intent: "charge",
      request: ENCODED_REQUEST,
      expires,
    };
    const credential = buildMppCredential(challenge, PREIMAGE);
    const decoded = JSON.parse(decodeBase64url(credential));
    expect(decoded.challenge.expires).toBe(expires);
  });
});

// ---------------------------------------------------------------------------
// fetchWithMpp
// ---------------------------------------------------------------------------
describe("fetchWithMpp", () => {
  test("returns initial response when no www-authenticate header", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce(JSON.stringify({ data: "free content" }), {
      status: 200,
    });

    const response = await fetchWithMpp(MPP_URL, {}, { wallet });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "free content" });
    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns initial response when www-authenticate is not Payment (e.g. L402)", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": `L402 macaroon="tok123", invoice="${INVOICE}"`,
      },
    });

    const response = await fetchWithMpp(MPP_URL, {}, { wallet });

    // Returns the 402 response without attempting payment
    expect(response.status).toBe(402);
    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("pays invoice and retries on Payment lightning/charge challenge", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ data: "paid content" }), {
      status: 200,
    });

    const response = await fetchWithMpp(MPP_URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);
    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "paid content" });
  });

  test("sets correct Authorization: Payment <token> header on retry", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithMpp(MPP_URL, {}, { wallet });

    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    const headers = secondCallInit.headers as Headers;
    const authHeader = headers.get("Authorization")!;

    // Must be "Payment <base64url-token>" — no credential="" wrapper
    expect(authHeader).toMatch(/^Payment [A-Za-z0-9_-]+$/);

    const token = authHeader.replace(/^Payment /, "");
    const decoded = JSON.parse(decodeBase64url(token));

    expect(decoded.challenge.id).toBe(CHALLENGE_ID);
    expect(decoded.challenge.realm).toBe(REALM);
    expect(decoded.challenge.method).toBe("lightning");
    expect(decoded.challenge.intent).toBe("charge");
    expect(decoded.challenge.request).toBe(ENCODED_REQUEST);
    expect(decoded.payload.preimage).toBe(PREIMAGE);
  });

  test("echoes expires in credential challenge when present in header", async () => {
    const wallet = makeWallet();
    const expires = "2026-12-31T23:59:59Z";

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
          expires,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithMpp(MPP_URL, {}, { wallet });

    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    const headers = secondCallInit.headers as Headers;
    const token = headers.get("Authorization")!.replace(/^Payment /, "");
    const decoded = JSON.parse(decodeBase64url(token));

    expect(decoded.challenge.expires).toBe(expires);
  });

  test("sets cache to no-store and mode to cors", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithMpp(MPP_URL, {}, { wallet });

    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchInit.cache).toBe("no-store");
    expect(fetchInit.mode).toBe("cors");
  });

  test("passes custom fetchArgs through to all fetch calls", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithMpp(
      MPP_URL,
      { method: "POST", headers: { "X-Custom": "value" } },
      { wallet },
    );

    for (const call of fetchMock.mock.calls) {
      const fetchInit = call[1] as RequestInit;
      const headers = fetchInit.headers as Headers;
      expect(fetchInit.method).toBe("POST");
      expect(headers.get("X-Custom")).toBe("value");
    }
  });

  test("propagates wallet.payInvoice errors", async () => {
    const wallet = {
      payInvoice: jest.fn().mockRejectedValue(new Error("payment failed")),
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });

    await expect(fetchWithMpp(MPP_URL, {}, { wallet })).rejects.toThrow(
      "payment failed",
    );
  });

  test("works with minimal options (wallet only)", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    const response = await fetchWithMpp(MPP_URL, {}, { wallet });
    expect(response.status).toBe(200);
    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);
  });

  test("throws when challenge is invalid (wrong method/intent)", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": `Payment id="${CHALLENGE_ID}", realm="${REALM}", method="onchain", intent="charge", request="${ENCODED_REQUEST}"`,
      },
    });

    await expect(fetchWithMpp(MPP_URL, {}, { wallet })).rejects.toThrow(
      "mpp: invalid or unsupported WWW-Authenticate challenge",
    );
  });

  test("throws when request auth-param is not valid base64url JSON", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": `Payment id="${CHALLENGE_ID}", realm="${REALM}", method="lightning", intent="charge", request="not-valid!!!"`,
      },
    });

    await expect(fetchWithMpp(MPP_URL, {}, { wallet })).rejects.toThrow(
      "mpp: invalid request auth-param (not valid base64url-encoded JSON)",
    );
  });

  test("throws when invoice is missing from request methodDetails", async () => {
    const wallet = makeWallet();
    const badRequest = encodeMppChargeRequest({
      amount: "10",
      currency: "sat",
      methodDetails: { invoice: "" },
    });

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: badRequest,
        }),
      },
    });

    await expect(fetchWithMpp(MPP_URL, {}, { wallet })).rejects.toThrow(
      "mpp: missing invoice in charge request",
    );
  });

  test("pays invoice twice on two sequential calls (consume-once, no caching)", async () => {
    const wallet = makeWallet();

    // First call
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ first: true }), {
      status: 200,
    });

    await fetchWithMpp(MPP_URL, {}, { wallet });

    // Second call — server issues a fresh challenge with a new id
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeMppWwwAuthenticateHeader({
          id: "newId_second_456",
          realm: REALM,
          request: ENCODED_REQUEST,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ second: true }), {
      status: 200,
    });

    await fetchWithMpp(MPP_URL, {}, { wallet });

    // Must have paid twice — no caching of credentials
    expect(wallet.payInvoice).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
