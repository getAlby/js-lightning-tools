import fetchMock from "jest-fetch-mock";
import { fetchWithL402 } from "./l402";
import { parseL402 } from "./utils";
import { makeL402AuthenticateHeader } from "./server/utils";

const MACAROON =
  "AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ==";
const INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";
// A real, decodable 402-sat invoice used where the payment amount is asserted.
const REAL_INVOICE =
  "lnbc4020n1p5m6028dq80q6rqvsnp4qt5w34u6kntf5lc50jj27rvs89sgrpcpj7s6vfts042gkhxx2j6swpp5g6tquvmswkv5xf0ru7ju2qvdrf83l2ewha3qzzt0a7vurs5q30rssp54kt5hfzjngjersx8fgt60feuu8e7vnat67f3ksr98twdj7z0m0ls9qyysgqcqzp2xqyz5vqrzjqdc22wfv6lyplagj37n9dmndkrzdz8rh3lxkewvvk6arkjpefats2rf47yqqwysqqcqqqqlgqqqqqqgqfqrzjq26922n6s5n5undqrf78rjjhgpcczafws45tx8237y7pzx3fg8ww8apyqqqqqqqqjyqqqqlgqqqqr4gq2q3z5pu33awfm98ac3ysdhy046xmen4zqval67tccu35x9mxgvl6w3wmq6y03ae7pme6qr20mp5gvuqntnu8yy7nlf6gyt9zshanj2zhgqe4xde3";
const PREIMAGE =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

const L402_URL = "https://example.com/protected";

function makeWallet(preimage: string = PREIMAGE) {
  return {
    payInvoice: jest.fn().mockResolvedValue({ preimage }),
  };
}

beforeEach(() => {
  fetchMock.resetMocks();
});

// ---------------------------------------------------------------------------
// parseL402
// ---------------------------------------------------------------------------
describe("parseL402", () => {
  test("should correctly parse L402 string with macaroon", () => {
    const testString = `L402 macaroon="${MACAROON}", invoice="${INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({ token: MACAROON, invoice: INVOICE });
  });

  test("should correctly parse L402 string based with token", () => {
    const testString = `L402 version="0", macaroon="${MACAROON}", invoice="${INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({
      version: "0",
      token: MACAROON,
      invoice: INVOICE,
    });
  });

  test("should correctly parse LSAT string", () => {
    const testString = `LSAT macaroon="${MACAROON}", invoice="${INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({ token: MACAROON, invoice: INVOICE });
  });

  test("should correctly handle unquoted values", () => {
    const testString = `L402 macaroon=${MACAROON}, invoice=${INVOICE}`;
    const result = parseL402(testString);
    expect(result).toEqual({ token: MACAROON, invoice: INVOICE });
  });

  test("should correctly handle single-quoted values", () => {
    const testString = `LSAT macaroon='${MACAROON}', invoice='${INVOICE}'`;
    const result = parseL402(testString);
    expect(result).toEqual({ token: MACAROON, invoice: INVOICE });
  });
});

// ---------------------------------------------------------------------------
// fetchWithL402
// ---------------------------------------------------------------------------
describe("fetchWithL402", () => {
  test("returns initial response when no www-authenticate header (non-402)", async () => {
    const wallet = makeWallet();
    const body = JSON.stringify({ data: "free content" });

    fetchMock.mockResponseOnce(body, { status: 200 });

    const response = await fetchWithL402(L402_URL, {}, { wallet });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "free content" });
    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("pays invoice and retries fetch on L402 challenge", async () => {
    const wallet = makeWallet();

    // First fetch: 402 with www-authenticate header
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: INVOICE,
        }),
      },
    });

    // Second fetch: success after payment
    const body = JSON.stringify({ data: "paid content" });
    fetchMock.mockResponseOnce(body, { status: 200 });

    const response = await fetchWithL402(L402_URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledTimes(1);
    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Verify the second request includes the Authorization header
    const secondCallInit = fetchMock.mock.calls[1][1] as RequestInit;
    const secondHeaders = secondCallInit.headers as Headers;
    expect(secondHeaders.get("Authorization")).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: "paid content" });
  });

  test("attaches payment info (credentials, amount, fee) after paying", async () => {
    const wallet = {
      payInvoice: jest
        .fn()
        .mockResolvedValue({ preimage: PREIMAGE, fees_paid: 1000 }),
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: REAL_INVOICE,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ data: "paid content" }), {
      status: 200,
    });

    const response = await fetchWithL402(L402_URL, {}, { wallet });

    expect(response.payment).toEqual({
      paid: true,
      amount: 402, // lnbc4020n = 402 sats
      feesPaid: 1000,
      preimage: PREIMAGE,
      credentials: {
        header: "Authorization",
        value: `L402 ${MACAROON}:${PREIMAGE}`,
      },
    });
  });

  test("does not attach payment info on free content", async () => {
    const wallet = makeWallet();
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    const response = await fetchWithL402(L402_URL, {}, { wallet });

    expect(response.payment).toBeUndefined();
  });

  test("reuses supplied credentials without paying again (polling)", async () => {
    const wallet = makeWallet();
    const credentials = {
      header: "Authorization",
      value: `L402 ${MACAROON}:${PREIMAGE}`,
    };

    // Server accepts the reused credential directly (no 402 challenge)
    fetchMock.mockResponseOnce(JSON.stringify({ status: "processing" }), {
      status: 200,
    });

    const response = await fetchWithL402(L402_URL, {}, { wallet, credentials });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The credential was applied to the request
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = callInit.headers as Headers;
    expect(headers.get("Authorization")).toBe(credentials.value);

    // and echoed back so the caller can keep polling
    expect(response.payment).toEqual({ paid: false, amount: 0, credentials });
  });

  test("NEVER pays again when supplied credentials are rejected with a fresh 402", async () => {
    // Core guarantee: once a credential is supplied, reuse it and NEVER pay a
    // second invoice — even if the server rejects it with a new challenge. The
    // 402 is returned so the caller decides (retry after settlement, top up).
    const wallet = makeWallet();
    const credentials = {
      header: "Authorization",
      value: "L402 stale:credential",
    };

    // Server rejects the reused credential with a fresh challenge
    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: INVOICE,
        }),
      },
    });

    const response = await fetchWithL402(L402_URL, {}, { wallet, credentials });

    // No payment was made, and only the single (credentialed) request was sent.
    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(402);
    // The supplied credential is echoed back so the caller can retry it later.
    expect(response.payment).toEqual({ paid: false, amount: 0, credentials });
  });

  test("propagates wallet.payInvoice errors", async () => {
    const wallet = {
      payInvoice: jest.fn().mockRejectedValue(new Error("payment failed")),
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: INVOICE,
        }),
      },
    });

    await expect(fetchWithL402(L402_URL, {}, { wallet })).rejects.toThrow(
      "payment failed",
    );
  });

  test("passes fetchArgs through to the underlying fetch calls", async () => {
    const wallet = makeWallet();
    const customHeaders = { "X-Custom": "value" };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "www-authenticate": makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: INVOICE,
        }),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithL402(
      L402_URL,
      { method: "POST", headers: customHeaders },
      { wallet },
    );

    // Both fetch calls should have the custom header and method
    for (const call of fetchMock.mock.calls) {
      const fetchInit = call[1] as RequestInit;
      const headers = fetchInit.headers as Headers;
      expect(fetchInit.method).toBe("POST");
      expect(headers.get("X-Custom")).toBe("value");
    }
  });

  test("sets cache to no-store and mode to cors on fetchArgs", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 });

    await fetchWithL402(L402_URL, {}, { wallet });

    const fetchInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchInit.cache).toBe("no-store");
    expect(fetchInit.mode).toBe("cors");
  });
});
