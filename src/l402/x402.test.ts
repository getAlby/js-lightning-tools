import fetchMock from "jest-fetch-mock";
import { fetchWithX402 } from "./x402";
import { MemoryStorage, NoStorage } from "./utils";

const INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";
const PREIMAGE =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

const X402_URL = "https://example.com/protected";

const REQUIREMENTS = {
  scheme: "exact",
  network: "lightning:mainnet",
  extra: { invoice: INVOICE },
};

function makePaymentRequiredHeader(
  requirements = REQUIREMENTS,
  accepts = [requirements],
): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ accepts }))));
}

function parsePaymentSignature(header: string): Record<string, unknown> {
  return JSON.parse(decodeURIComponent(escape(atob(header))));
}

function makeWallet(preimage: string = PREIMAGE) {
  return {
    payInvoice: jest.fn().mockResolvedValue({ preimage }),
  };
}

beforeEach(() => {
  fetchMock.resetMocks();
});

// ---------------------------------------------------------------------------
// fetchWithX402
// ---------------------------------------------------------------------------
describe("fetchWithX402", () => {
  test("returns initial response when no PAYMENT-REQUIRED header", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce(JSON.stringify({ data: "free content" }), {
      status: 200,
    });

    const response = await fetchWithX402(X402_URL, {}, { wallet });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "free content" });
    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("pays invoice and retries fetch on 402 challenge", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ data: "paid content" }), {
      status: 200,
    });

    const response = await fetchWithX402(X402_URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);
    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "paid content" });
  });

  test("sets correct payment-signature header on retry", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithX402(X402_URL, {}, { wallet });

    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    const headers = secondCallInit.headers as Record<string, string>;
    const sig = parsePaymentSignature(headers["payment-signature"]);

    expect(sig).toMatchObject({
      x402Version: 2,
      scheme: REQUIREMENTS.scheme,
      network: REQUIREMENTS.network,
      payload: { preimage: PREIMAGE },
      accepted: REQUIREMENTS,
    });
  });

  test("stores payment data after successful payment", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithX402(X402_URL, {}, { wallet, store });

    const stored = JSON.parse(store.getItem(X402_URL));
    expect(stored).toMatchObject({
      scheme: REQUIREMENTS.scheme,
      network: REQUIREMENTS.network,
      preimage: PREIMAGE,
      requirements: REQUIREMENTS,
    });
  });

  test("uses cached payment data without calling wallet", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    store.setItem(
      X402_URL,
      JSON.stringify({
        scheme: REQUIREMENTS.scheme,
        network: REQUIREMENTS.network,
        preimage: PREIMAGE,
        requirements: REQUIREMENTS,
      }),
    );

    fetchMock.mockResponseOnce(JSON.stringify({ data: "cached access" }), {
      status: 200,
    });

    const response = await fetchWithX402(X402_URL, {}, { wallet, store });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ data: "cached access" });

    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = callInit.headers as Record<string, string>;
    const sig = parsePaymentSignature(headers["payment-signature"]);
    expect(sig).toMatchObject({
      x402Version: 2,
      scheme: REQUIREMENTS.scheme,
      network: REQUIREMENTS.network,
      payload: { preimage: PREIMAGE },
    });
  });

  test("second request reuses cached data without re-paying", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ first: true }), {
      status: 200,
    });

    await fetchWithX402(X402_URL, {}, { wallet, store });
    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);

    fetchMock.mockResponseOnce(JSON.stringify({ second: true }), {
      status: 200,
    });

    const response = await fetchWithX402(X402_URL, {}, { wallet, store });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(1); // still only 1
    expect(await response.json()).toEqual({ second: true });
  });

  test("works with NoStorage (never caches, pays every time)", async () => {
    const wallet = makeWallet();
    const store = new NoStorage();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ first: true }), {
      status: 200,
    });

    await fetchWithX402(X402_URL, {}, { wallet, store });

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ second: true }), {
      status: 200,
    });

    await fetchWithX402(X402_URL, {}, { wallet, store });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test("falls through on incomplete cache entry (missing preimage)", async () => {
    const wallet = makeWallet();
    const store = new MemoryStorage();

    store.setItem(
      X402_URL,
      JSON.stringify({
        scheme: "exact",
        network: "lightning:mainnet",
        // no preimage, no requirements
      }),
    );

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithX402(X402_URL, {}, { wallet, store });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);
  });

  test("throws on invalid base64 PAYMENT-REQUIRED header", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": "not-valid-base64!!!" },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "x402: invalid PAYMENT-REQUIRED header (not valid base64-encoded JSON)",
    );
  });

  test("throws on valid base64 but non-JSON PAYMENT-REQUIRED header", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": btoa("this is not json") },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "x402: invalid PAYMENT-REQUIRED header (not valid base64-encoded JSON)",
    );
  });

  test("throws when accepts array is empty", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": makePaymentRequiredHeader(REQUIREMENTS, []),
      },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "x402: PAYMENT-REQUIRED header contains no payment options",
    );
  });

  test("throws when no accepted entry has a lightning network", async () => {
    const wallet = makeWallet();
    const nonLightning = {
      scheme: "exact",
      network: "bitcoin:mainnet",
      extra: { invoice: INVOICE },
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": makePaymentRequiredHeader(nonLightning as never, [
          nonLightning as never,
        ]),
      },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "x402: unsupported x402 network, only lightning networks are supported",
    );
  });

  test("throws when requirements missing invoice", async () => {
    const wallet = makeWallet();
    const bad = { scheme: "exact", network: "lightning:mainnet", extra: {} };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader(bad as never) },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "x402: payment requirements missing lightning invoice",
    );
  });

  test("accepts lightning:testnet network", async () => {
    const wallet = makeWallet();
    const testnet = {
      scheme: "exact",
      network: "lightning:testnet",
      extra: { invoice: INVOICE },
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": makePaymentRequiredHeader(testnet as never),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await expect(
      fetchWithX402(X402_URL, {}, { wallet }),
    ).resolves.toBeDefined();
    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);
  });

  test("picks first lightning entry when accepts contains mixed networks", async () => {
    const wallet = makeWallet();
    const nonLightning = {
      scheme: "exact",
      network: "bitcoin:mainnet",
      extra: { invoice: "other" },
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": makePaymentRequiredHeader(REQUIREMENTS, [
          nonLightning as never,
          REQUIREMENTS,
        ]),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithX402(X402_URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
  });

  test("propagates wallet payment errors", async () => {
    const wallet = {
      payInvoice: jest.fn().mockRejectedValue(new Error("payment failed")),
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "payment failed",
    );
  });

  test("sets cache to no-store and mode to cors", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithX402(X402_URL, {}, { wallet });

    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchInit.cache).toBe("no-store");
    expect(fetchInit.mode).toBe("cors");
  });

  test("passes custom fetchArgs through to all fetch calls", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithX402(
      X402_URL,
      { method: "POST", headers: { "X-Custom": "value" } },
      { wallet },
    );

    for (const call of fetchMock.mock.calls) {
      const fetchInit = call[1] as RequestInit;
      const headers = fetchInit.headers as Record<string, string>;
      expect(fetchInit.method).toBe("POST");
      expect(headers["X-Custom"]).toBe("value");
    }
  });
});
