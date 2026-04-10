import fetchMock from "jest-fetch-mock";
import { fetchWithL402 } from "./l402";
import { parseL402 } from "./utils";
import { makeL402AuthenticateHeader } from "./server/utils";

const MACAROON =
  "AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ==";
const INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";
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
