import fetchMock from "jest-fetch-mock";
import { fetchWithX402 } from "./x402";
import { Fetch402InterruptedError } from "../utils";
import { Invoice } from "../../bolt11";
import {
  LNBTC_INVOICE as INVOICE,
  LNBTC_PREIMAGE as PREIMAGE,
  LNBTC_REQUIREMENTS as REQUIREMENTS,
  LNBTC_URL as X402_URL,
  LNBTC_VALIDATION_TIME_MS,
} from "./testVector";

function makePaymentRequiredHeader(
  requirements = REQUIREMENTS,
  accepts = [requirements],
): string {
  return btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({ resource: { url: X402_URL }, accepts }),
      ),
    ),
  );
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
  jest.spyOn(Date, "now").mockReturnValue(LNBTC_VALIDATION_TIME_MS);
});

afterEach(() => {
  jest.restoreAllMocks();
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

    expect(sig.payload).toEqual({ preimage: PREIMAGE });
    expect(sig.accepted).toEqual(REQUIREMENTS);
  });

  test("attaches payment info (credentials, amount, fee) after paying", async () => {
    const wallet = {
      payInvoice: jest
        .fn()
        .mockResolvedValue({ preimage: PREIMAGE, fees_paid: 500 }),
    };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader() },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ data: "paid content" }), {
      status: 200,
    });

    const response = await fetchWithX402(X402_URL, {}, { wallet });

    expect(response.payment?.paid).toBe(true);
    expect(response.payment?.amountSat).toBe(25); // lnbc250n = 25 sats
    expect(response.payment?.feesPaidMsat).toBe(500);
    expect(response.payment?.preimage).toBe(PREIMAGE);
    expect(response.payment?.credentials.header).toBe("payment-signature");
    // The returned credential is exactly the payment-signature that was sent
    const sentSig = (fetchMock.mock.calls[1][1] as RequestInit)
      .headers as Headers;
    expect(response.payment?.credentials.value).toBe(
      sentSig.get("payment-signature"),
    );
  });

  test("reuses supplied credentials without paying again (polling)", async () => {
    const wallet = makeWallet();
    const credentials = { header: "payment-signature", value: "cached-sig" };

    fetchMock.mockResponseOnce(JSON.stringify({ status: "processing" }), {
      status: 200,
    });

    const response = await fetchWithX402(X402_URL, {}, { wallet, credentials });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    const callInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect((callInit.headers as Headers).get("payment-signature")).toBe(
      "cached-sig",
    );
    expect(response.payment).toEqual({
      paid: false,
      amountSat: 0,
      credentials,
    });
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
      network: "eip155:8453",
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
    const bad = { ...REQUIREMENTS, extra: {} };

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "PAYMENT-REQUIRED": makePaymentRequiredHeader(bad as never) },
    });

    await expect(fetchWithX402(X402_URL, {}, { wallet })).rejects.toThrow(
      "x402: payment requirements missing lightning invoice",
    );
  });

  test("picks first lightning entry when accepts contains mixed networks", async () => {
    const wallet = makeWallet();
    const nonLightning = {
      scheme: "exact",
      network: "eip155:8453",
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

    const error = await fetchWithX402(X402_URL, {}, { wallet }).catch((e) => e);
    expect(error).toBeInstanceOf(Fetch402InterruptedError);
    expect(error.paid).toBe(false);
    expect(error.invoice).toBe(INVOICE);
    expect(error.paymentHash).toBe(new Invoice({ pr: INVOICE }).paymentHash);
    expect(error.preimage).toBeUndefined();
    expect(error.credentials).toBeUndefined();
    expect((error.cause as Error).message).toBe("payment failed");
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
      { headers: { "X-Custom": "value" } },
      { wallet },
    );

    for (const call of fetchMock.mock.calls) {
      const fetchInit = call[1] as RequestInit;
      const headers = fetchInit.headers as Headers;
      expect(headers.get("X-Custom")).toBe("value");
    }
  });
});
