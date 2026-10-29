import fetchMock from "jest-fetch-mock";
import { fetchWithX402 } from "./x402";
import { computeHttpRequestHash } from "./lnbtc";

// Test vector from the x402 `exact` Lightning spec (scheme_exact_lnbtc.md):
// GET https://api.example.com/article/A, empty body, no bound headers, signed
// with the test-only private key 0x01. Validation time is 1700000000.
const URL_A = "https://api.example.com/article/A";
const INVOICE =
  "lnbc250n1pj48ugqpp54y3u9s8ylemsv8l3ewyzzu0klhujvuvmkl6llchq23vy8rzjsf0qsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp5p4nz8am4uqj4q8a87z3sk4x6yk4dv2mvel34epw68qqkwy0xcqvqxqzfvcqpjr4rx6ls6j5rpwknuea64evlk7yfx56wmqcer5eerekdsn9tlv6v4ex9mlz5dtm9qapl3svwlqcf7837dmjkru9z9w4h2rvm0md52w2sqxrwu5f";
const PREIMAGE =
  "0001020304050607080900010203040506070809000102030405060708090102";
const REQUIREMENTS = {
  scheme: "exact",
  network: "lnbtc:000000000019d6689c085ae165831e93",
  amount: "25000",
  asset: "BTC",
  payTo: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "bolt11",
    paymentFlow: "upfront",
    requestHash:
      "0d6623f775e025501fa7f0a30b54da25aad62b6ccfe35c85da38016711e6c018",
    requestBindingProfile: "http:1",
    requestBindingParams: { headers: [] as string[] },
    invoice: INVOICE,
  },
};

function makePaymentRequiredHeader(
  requirements: unknown = REQUIREMENTS,
  resourceUrl = URL_A,
): string {
  return btoa(
    JSON.stringify({
      x402Version: 2,
      resource: { url: resourceUrl },
      accepts: [requirements],
    }),
  );
}

function withExtra(extra: Record<string, unknown>) {
  return { ...REQUIREMENTS, extra: { ...REQUIREMENTS.extra, ...extra } };
}

function makeWallet(preimage = PREIMAGE) {
  return { payInvoice: jest.fn().mockResolvedValue({ preimage }) };
}

function mock402(header = makePaymentRequiredHeader()) {
  fetchMock.mockResponseOnce("", {
    status: 402,
    headers: { "PAYMENT-REQUIRED": header },
  });
}

beforeEach(() => {
  fetchMock.resetMocks();
  jest.spyOn(Date, "now").mockReturnValue(1700000000 * 1000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("computeHttpRequestHash", () => {
  test("matches the spec test vectors", async () => {
    const args = { headers: new Headers(), boundHeaders: [] };
    expect(await computeHttpRequestHash({ ...args, url: URL_A })).toBe(
      REQUIREMENTS.extra.requestHash,
    );
    expect(
      await computeHttpRequestHash({
        ...args,
        url: "https://api.example.com/article/B",
      }),
    ).toBe("4a99860f75eed1ea8178a5db488e044173bc570c8a6210f2c8590cdf8622d509");
  });

  test("binds method, body and present/absent headers", async () => {
    const base = await computeHttpRequestHash({
      url: URL_A,
      headers: new Headers(),
      boundHeaders: ["accept"],
    });
    const variants = await Promise.all([
      computeHttpRequestHash({
        url: URL_A,
        method: "post",
        headers: new Headers(),
        boundHeaders: ["accept"],
      }),
      computeHttpRequestHash({
        url: URL_A,
        body: "x",
        headers: new Headers(),
        boundHeaders: ["accept"],
      }),
      computeHttpRequestHash({
        url: URL_A,
        headers: new Headers({ accept: "" }),
        boundHeaders: ["accept"],
      }),
    ]);
    expect(new Set([base, ...variants]).size).toBe(4);
  });
});

describe("fetchWithX402 with exact/lnbtc", () => {
  test("pays the invoice and sends the preimage as payload", async () => {
    const wallet = makeWallet();
    mock402();
    fetchMock.mockResponseOnce("paid", { status: 200 });

    const response = await fetchWithX402(URL_A, {}, { wallet });

    expect(response.status).toBe(200);
    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    const sent = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(JSON.parse(atob(sent.get("payment-signature")!))).toEqual({
      x402Version: 2,
      accepted: REQUIREMENTS,
      payload: { preimage: PREIMAGE },
    });
  });

  test("prefers the lnbtc entry over a legacy lightning entry", async () => {
    const wallet = makeWallet();
    const legacy = {
      scheme: "exact",
      network: "bip122:000000000019d6689c085ae165831e93",
      extra: { invoice: "lnbc1legacy", paymentMethod: "lightning" },
    };
    mock402(
      btoa(
        JSON.stringify({
          resource: { url: URL_A },
          accepts: [legacy, REQUIREMENTS],
        }),
      ),
    );
    fetchMock.mockResponseOnce("paid", { status: 200 });

    await fetchWithX402(URL_A, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
  });

  test.each([
    [
      "the request differs from the bound request",
      makePaymentRequiredHeader(
        withExtra({
          requestHash:
            "4a99860f75eed1ea8178a5db488e044173bc570c8a6210f2c8590cdf8622d509",
        }),
        "https://api.example.com/article/B",
      ),
      "https://api.example.com/article/B",
      "invalid_exact_lnbtc_invoice_request_mismatch",
    ],
    [
      "requestHash does not match the request",
      makePaymentRequiredHeader(
        withExtra({
          requestHash:
            "4a99860f75eed1ea8178a5db488e044173bc570c8a6210f2c8590cdf8622d509",
        }),
      ),
      URL_A,
      "invalid_exact_lnbtc_request_mismatch",
    ],
    [
      "the resource url differs from the request url",
      makePaymentRequiredHeader(),
      URL_A + "?x=1",
      "invalid_exact_lnbtc_request_binding",
    ],
    [
      "payTo is not the invoice signer",
      makePaymentRequiredHeader({
        ...REQUIREMENTS,
        payTo:
          "02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5",
      }),
      URL_A,
      "invalid_exact_lnbtc_invoice_payee_mismatch",
    ],
    [
      "the amount differs from the invoice",
      makePaymentRequiredHeader({ ...REQUIREMENTS, amount: "1000" }),
      URL_A,
      "invalid_exact_lnbtc_invoice_amount_mismatch",
    ],
    [
      "maxTimeoutSeconds differs from the invoice expiry",
      makePaymentRequiredHeader({ ...REQUIREMENTS, maxTimeoutSeconds: 600 }),
      URL_A,
      "invalid_exact_lnbtc_invoice_expiry_mismatch",
    ],
    [
      "the network is not supported",
      makePaymentRequiredHeader({
        ...REQUIREMENTS,
        network: "lnbtc:00000008819873e925422c1ff0f99f7c",
      }),
      URL_A,
      "unsupported_network",
    ],
    [
      "the network does not match the invoice currency",
      makePaymentRequiredHeader({
        ...REQUIREMENTS,
        network: "lnbtc:000000000933ea01ad0ee984209779ba",
      }),
      URL_A,
      "invalid_exact_lnbtc_invoice_currency_mismatch",
    ],
    [
      "the payment flow is missing",
      makePaymentRequiredHeader(withExtra({ paymentFlow: undefined })),
      URL_A,
      "invalid_exact_lnbtc_payment_flow",
    ],
    [
      "the request binding profile is mcp",
      makePaymentRequiredHeader(withExtra({ requestBindingProfile: "mcp:1" })),
      URL_A,
      "invalid_exact_lnbtc_request_binding",
    ],
    [
      "binding params contain an unknown member",
      makePaymentRequiredHeader(
        withExtra({ requestBindingParams: { headers: [], extra: 1 } }),
      ),
      URL_A,
      "invalid_exact_lnbtc_request_binding",
    ],
  ])("refuses to pay when %s", async (_, header, url, reason) => {
    const wallet = makeWallet();
    mock402(header);

    await expect(fetchWithX402(url, {}, { wallet })).rejects.toThrow(reason);
    expect(wallet.payInvoice).not.toHaveBeenCalled();
  });

  test("refuses to pay an expired invoice", async () => {
    jest.spyOn(Date, "now").mockReturnValue((1700000000 + 300) * 1000);
    const wallet = makeWallet();
    mock402();

    await expect(fetchWithX402(URL_A, {}, { wallet })).rejects.toThrow(
      "invalid_exact_lnbtc_invoice_expired",
    );
    expect(wallet.payInvoice).not.toHaveBeenCalled();
  });

  test("rejects a wallet preimage that does not match the payment hash", async () => {
    const wallet = makeWallet("ff".repeat(32));
    mock402();

    await expect(fetchWithX402(URL_A, {}, { wallet })).rejects.toThrow(
      "invalid_exact_lnbtc_payer_preimage_hash_mismatch",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("resumes an interrupted payment with the recovered preimage", async () => {
    fetchMock.mockResponseOnce("paid", { status: 200 });

    const response = await fetchWithX402(
      URL_A,
      {},
      {
        wallet: makeWallet(),
        resume: {
          pendingPayment: {
            scheme: "x402",
            header: "payment-signature",
            accepted: REQUIREMENTS,
          },
          preimage: PREIMAGE,
        },
      },
    );

    expect(response.status).toBe(200);
    const sent = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(JSON.parse(atob(sent.get("payment-signature")!)).payload).toEqual({
      preimage: PREIMAGE,
    });
  });
});
