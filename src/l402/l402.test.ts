import fetchMock from "jest-fetch-mock";
import { fetchWithL402 } from "./l402";
import { MemoryStorage, NoStorage, parseL402 } from "./utils";

const MACAROON =
  "AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ==";
const HEX_MAC =
  "jkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8x";
const INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";
const PREIMAGE =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

const L402_URL = "https://example.com/protected";

function makeWwwAuthHeader(key: string = "L402") {
  return `${key} macaroon="${MACAROON}", invoice="${INVOICE}"`;
}

function makeWallet(preimage: string = PREIMAGE) {
  return {
    sendPayment: jest.fn().mockResolvedValue({ preimage }),
  };
}

beforeEach(() => {
  fetchMock.resetMocks();
});

// ---------------------------------------------------------------------------
// parseL402
// ---------------------------------------------------------------------------
describe("parseL402", () => {
  test("should correctly parse L402 string", () => {
    const testString = `L402 macaroon="${MACAROON}", invoice="${INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: MACAROON, invoice: INVOICE });
  });

  test("should correctly parse LSAT string", () => {
    const testString = `LSAT macaroon="${MACAROON}", invoice="${INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: MACAROON, invoice: INVOICE });
  });

  test("should correctly handle unquoted values", () => {
    const testString = `L402 macaroon=${MACAROON}, invoice=${INVOICE}`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: MACAROON, invoice: INVOICE });
  });

  test("should correctly handle single-quoted values", () => {
    const testString = `LSAT macaroon='${MACAROON}', invoice='${INVOICE}'`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: MACAROON, invoice: INVOICE });
  });

  test("should correctly handle hexadecimal macaroon values", () => {
    const testString = `LSAT macaroon='${HEX_MAC}', invoice='${INVOICE}'`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: HEX_MAC, invoice: INVOICE });
  });
});

// ---------------------------------------------------------------------------
// fetchWithL402
// ---------------------------------------------------------------------------
describe("fetchWithL402", () => {
  test("throws when no wallet is provided", async () => {
    await expect(
      fetchWithL402(L402_URL, {}, { store: new MemoryStorage() }),
    ).rejects.toThrow("wallet is missing");
  });

  test("throws when wallet is explicitly undefined", async () => {
    await expect(
      fetchWithL402(L402_URL, {}, { wallet: undefined, store: new MemoryStorage() }),
    ).rejects.toThrow("wallet is missing");
  });

  test("returns initial response when no www-authenticate header (non-402)", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();
    const body = JSON.stringify({ data: "free content" });

    fetchMock.mockResponseOnce(body, { status: 200 });

    const response = await fetchWithL402(L402_URL, {}, { wallet, store });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "free content" });
    expect(wallet.sendPayment).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("pays invoice and retries fetch on L402 challenge", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    // First fetch: 402 with www-authenticate header
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });

    // Second fetch: success after payment
    const body = JSON.stringify({ data: "paid content" });
    fetchMock.mockResponseOnce(body, { status: 200 });

    const response = await fetchWithL402(L402_URL, {}, { wallet, store });

    expect(wallet.sendPayment).toHaveBeenCalledTimes(1);
    expect(wallet.sendPayment).toHaveBeenCalledWith(INVOICE);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Verify the second request includes the Authorization header
    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    const secondHeaders = secondCallInit.headers as Record<string, string>;
    expect(secondHeaders["Authorization"]).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "paid content" });
  });

  test("stores token and preimage after successful payment", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithL402(L402_URL, {}, { wallet, store });

    const stored = JSON.parse(store.getItem(L402_URL));
    expect(stored).toEqual({
      token: MACAROON,
      preimage: PREIMAGE,
    });
  });

  test("uses cached L402 data from store without calling wallet", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    // Pre-populate the store with cached L402 data
    store.setItem(
      L402_URL,
      JSON.stringify({ token: MACAROON, preimage: PREIMAGE }),
    );

    const body = JSON.stringify({ data: "cached access" });
    fetchMock.mockResponseOnce(body, { status: 200 });

    const response = await fetchWithL402(L402_URL, {}, { wallet, store });

    expect(wallet.sendPayment).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Verify the Authorization header was set from the cache
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = callInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`,
    );

    expect(await response.json()).toEqual({ data: "cached access" });
  });

  test("uses custom LSAT headerKey", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader("LSAT") },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithL402(L402_URL, {}, { wallet, store, headerKey: "LSAT" });

    // Verify the second request uses LSAT in the Authorization header
    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    const secondHeaders = secondCallInit.headers as Record<string, string>;
    expect(secondHeaders["Authorization"]).toBe(
      `LSAT ${MACAROON}:${PREIMAGE}`,
    );
  });

  test("works with NoStorage (never caches)", async () => {
    const wallet = makeWallet();
    const store = new NoStorage();

    // First request flow
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ first: true }), {
      status: 200,
    });

    await fetchWithL402(L402_URL, {}, { wallet, store });

    // Second request flow — should NOT use cache since NoStorage always returns null
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ second: true }), {
      status: 200,
    });

    await fetchWithL402(L402_URL, {}, { wallet, store });

    // wallet.sendPayment should have been called twice (no caching)
    expect(wallet.sendPayment).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("propagates wallet.sendPayment errors", async () => {
    const wallet = {
      sendPayment: jest
        .fn()
        .mockRejectedValue(new Error("payment failed")),
    };
    const store = new MemoryStorage();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });

    await expect(
      fetchWithL402(L402_URL, {}, { wallet, store }),
    ).rejects.toThrow("payment failed");
  });

  test("passes fetchArgs through to the underlying fetch calls", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();
    const customHeaders = { "X-Custom": "value" };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithL402(
      L402_URL,
      { method: "POST", headers: customHeaders },
      { wallet, store },
    );

    // Both fetch calls should have the custom header and method
    for (const call of fetchMock.mock.calls) {
      const fetchInit = call[1] as RequestInit;
      const headers = fetchInit.headers as Record<string, string>;
      expect(fetchInit.method).toBe("POST");
      expect(headers["X-Custom"]).toBe("value");
    }
  });

  test("sets cache to no-store and mode to cors on fetchArgs", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithL402(L402_URL, {}, { wallet, store });

    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchInit.cache).toBe("no-store");
    expect(fetchInit.mode).toBe("cors");
  });

  test("second request after payment reuses token from store", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    // First request: full L402 handshake
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "www-authenticate": makeWwwAuthHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ first: true }), {
      status: 200,
    });

    await fetchWithL402(L402_URL, {}, { wallet, store });
    expect(wallet.sendPayment).toHaveBeenCalledTimes(1);

    // Second request: should use cached token, no new payment
    fetchMock.mockResponseOnce(JSON.stringify({ second: true }), {
      status: 200,
    });

    const response = await fetchWithL402(L402_URL, {}, { wallet, store });

    expect(wallet.sendPayment).toHaveBeenCalledTimes(1); // still only 1
    expect(await response.json()).toEqual({ second: true });

    const lastCallInit = fetchMock.mock.calls[2][1] as RequestInit;
    const lastHeaders = lastCallInit.headers as Record<string, string>;
    expect(lastHeaders["Authorization"]).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`,
    );
  });
});