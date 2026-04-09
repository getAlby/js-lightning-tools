import fetchMock from "jest-fetch-mock";
import { fetchWithX402 } from "./x402";

const INVOICE =
  "lnbc4020n1p5m6028dq80q6rqvsnp4qt5w34u6kntf5lc50jj27rvs89sgrpcpj7s6vfts042gkhxx2j6swpp5g6tquvmswkv5xf0ru7ju2qvdrf83l2ewha3qzzt0a7vurs5q30rssp54kt5hfzjngjersx8fgt60feuu8e7vnat67f3ksr98twdj7z0m0ls9qyysgqcqzp2xqyz5vqrzjqdc22wfv6lyplagj37n9dmndkrzdz8rh3lxkewvvk6arkjpefats2rf47yqqwysqqcqqqqlgqqqqqqgqfqrzjq26922n6s5n5undqrf78rjjhgpcczafws45tx8237y7pzx3fg8ww8apyqqqqqqqqjyqqqqlgqqqqr4gq2q3z5pu33awfm98ac3ysdhy046xmen4zqval67tccu35x9mxgvl6w3wmq6y03ae7pme6qr20mp5gvuqntnu8yy7nlf6gyt9zshanj2zhgqe4xde3";
const PREIMAGE =
  "8196e90022ce688d911554d02af67d3d6a72143961c1e1aa12c4720538ea0549";

const X402_URL = "https://example.com/protected";

const REQUIREMENTS = {
  scheme: "exact",
  network: "bip122:000000000019d6689c085ae165831e93",
  amount: "402000",
  asset: "btc",
  extra: { invoice: INVOICE, paymentMethod: "lightning" },
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
    const headers = secondCallInit.headers as Headers;
    const sig = parsePaymentSignature(headers.get("payment-signature")!);

    const payload = sig.payload as { invoice: string };
    expect(payload.invoice).toEqual(INVOICE);
    expect(sig.accepted).toEqual(REQUIREMENTS);
  });

  test("pays invoice on every request (no caching)", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ first: true }), {
      status: 200,
    });

    await fetchWithX402(X402_URL, {}, { wallet });

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ second: true }), {
      status: 200,
    });

    await fetchWithX402(X402_URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
      network: "bip122:something",
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
      "x402: unsupported x402 network, only Bitcoin lightning network is supported.",
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
      "x402: unsupported x402 network, only Bitcoin lightning network is supported.",
    );
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
      const headers = fetchInit.headers as Headers;
      expect(fetchInit.method).toBe("POST");
      expect(headers.get("X-Custom")).toBe("value");
    }
  });
});
