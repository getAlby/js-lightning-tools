import fetchMock from "jest-fetch-mock";
import { fetchWithX402 } from "./x402";
import { applyImplicitHeaders, computeHttpRequestHash } from "./lnbtc";
import { createHash } from "crypto";
import { Fetch402InterruptedError } from "../utils";

import {
  LNBTC_INVOICE as INVOICE,
  LNBTC_PREIMAGE as PREIMAGE,
  LNBTC_REQUIREMENTS as REQUIREMENTS,
  LNBTC_URL as URL_A,
  LNBTC_VALIDATION_TIME_MS,
  SIGNET_REQUIREMENTS,
  SIGNET_URL,
  SIGNET_VALIDATION_TIME_MS,
} from "./testVector";

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
  jest.spyOn(Date, "now").mockReturnValue(LNBTC_VALIDATION_TIME_MS);
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

describe("bound request contents", () => {
  const sha256 = (data: Buffer | string) =>
    createHash("sha256").update(data).digest("hex");

  test("hashes a POST body and present/absent headers per the http:1 profile", async () => {
    const body = '{"a":1}';
    const actual = await computeHttpRequestHash({
      url: URL_A,
      method: "post",
      headers: new Headers({ "content-type": "application/json" }),
      body,
      boundHeaders: ["accept", "content-type"],
    });

    // Independent construction of the JCS binding object from the spec.
    const canonical =
      `{"bodyHash":"${sha256(body)}",` +
      `"domain":"x402:exact:lnbtc:bolt11:http:1",` +
      `"headers":[{"name":"accept","valueHash":"${sha256(Buffer.from([0]))}"},` +
      `{"name":"content-type","valueHash":"${sha256(Buffer.concat([Buffer.from([1]), Buffer.from("application/json")]))}"}],` +
      `"method":"POST","url":"${URL_A}"}`;
    expect(actual).toBe(sha256(canonical));
  });

  test("hashes Blob and byte bodies like the equivalent string body", async () => {
    const hash = (body: RequestInit["body"]) =>
      computeHttpRequestHash({
        url: URL_A,
        method: "POST",
        headers: new Headers(),
        body,
        boundHeaders: [],
      });
    const expected = await hash("x".repeat(100000));
    expect(await hash(new Blob(["x".repeat(100000)]))).toBe(expected);
    expect(await hash(new TextEncoder().encode("x".repeat(100000)))).toBe(
      expected,
    );
  });

  test("sets the headers fetch would add implicitly when they are bound", () => {
    const headers = new Headers();
    applyImplicitHeaders(headers, "text", ["accept", "content-type"]);
    expect(headers.get("accept")).toBe("*/*");
    expect(headers.get("content-type")).toBe("text/plain;charset=UTF-8");

    const form = new Headers();
    applyImplicitHeaders(form, new URLSearchParams("a=1"), ["content-type"]);
    expect(form.get("content-type")).toBe(
      "application/x-www-form-urlencoded;charset=UTF-8",
    );

    const explicit = new Headers({ "content-type": "application/json" });
    applyImplicitHeaders(explicit, "{}", ["accept", "content-type"]);
    expect(explicit.get("content-type")).toBe("application/json");

    const unbound = new Headers();
    applyImplicitHeaders(unbound, "text", []);
    expect([...unbound.keys()]).toEqual([]);
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
        network: "lnbtc:0f9188f13cb7b2c71f2a335e3a4fc328",
      }),
      URL_A,
      "unsupported x402 network",
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
      "the signet network does not match a mainnet invoice",
      makePaymentRequiredHeader({
        ...REQUIREMENTS,
        network: "lnbtc:00000008819873e925422c1ff0f99f7c",
      }),
      URL_A,
      "invoice currency bc does not match lnbtc:00000008819873e925422c1ff0f99f7c",
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

    const error = await fetchWithX402(URL_A, {}, { wallet }).catch((e) => e);

    expect(error).toBeInstanceOf(Fetch402InterruptedError);
    expect(error.paid).toBe(true);
    expect(error.preimage).toBe("ff".repeat(32));
    expect(error.credentials).toBeUndefined();
    expect((error.cause as Error).message).toContain(
      "invalid_exact_lnbtc_payer_preimage_hash_mismatch",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("accepts a preimage returned in uppercase hex and sends it lowercase", async () => {
    mock402();
    fetchMock.mockResponseOnce("paid", { status: 200 });

    await fetchWithX402(
      URL_A,
      {},
      { wallet: makeWallet(PREIMAGE.toUpperCase()) },
    );

    const sent = new Headers(fetchMock.mock.calls[1][1]?.headers);
    expect(JSON.parse(atob(sent.get("payment-signature")!)).payload).toEqual({
      preimage: PREIMAGE,
    });
  });

  test("skips entries on unsupported lnbtc networks and pays a supported one", async () => {
    const wallet = makeWallet();
    const signet = {
      ...REQUIREMENTS,
      network: "lnbtc:0f9188f13cb7b2c71f2a335e3a4fc328",
    };
    mock402(
      btoa(
        JSON.stringify({
          resource: { url: URL_A },
          accepts: [signet, REQUIREMENTS],
        }),
      ),
    );
    fetchMock.mockResponseOnce("paid", { status: 200 });

    const response = await fetchWithX402(URL_A, {}, { wallet });

    expect(response.status).toBe(200);
    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
  });

  test("resolves a relative url against the page location", async () => {
    const g = globalThis as { location?: { href: string } };
    g.location = { href: "https://api.example.com/index.html" };
    try {
      const wallet = makeWallet();
      mock402();
      fetchMock.mockResponseOnce("paid", { status: 200 });

      const response = await fetchWithX402("/article/A", {}, { wallet });

      expect(response.status).toBe(200);
      expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    } finally {
      delete g.location;
    }
  });

  test("pays a real signed signet (lntbs) invoice", async () => {
    jest.spyOn(Date, "now").mockReturnValue(SIGNET_VALIDATION_TIME_MS);
    const wallet = makeWallet();
    mock402(makePaymentRequiredHeader(SIGNET_REQUIREMENTS, SIGNET_URL));

    // Every pre-payment check passes; the fake wallet's preimage is then
    // rejected because we don't know the real one.
    const error = await fetchWithX402(SIGNET_URL, {}, { wallet }).catch(
      (e) => e,
    );

    expect(wallet.payInvoice).toHaveBeenCalledWith({
      invoice: SIGNET_REQUIREMENTS.extra.invoice,
    });
    expect(error).toBeInstanceOf(Fetch402InterruptedError);
    expect(error.paid).toBe(true);
  });

  test("sends a snapshot of a byte body, not later mutations", async () => {
    const body = new TextEncoder().encode("x");
    const bound = withExtra({
      requestHash: await computeHttpRequestHash({
        url: URL_A,
        method: "POST",
        headers: new Headers(),
        body: "x",
        boundHeaders: [],
      }),
    });
    const fetchArgs: RequestInit = { method: "POST", body };
    mock402(makePaymentRequiredHeader(bound));

    // The invoice commits to GET article A, so validation stops before paying;
    // by then the body has already been swapped for a copy.
    await fetchWithX402(URL_A, fetchArgs, { wallet: makeWallet() }).catch(
      () => undefined,
    );
    body[0] = 0;

    expect(new TextDecoder().decode(fetchArgs.body as Uint8Array)).toBe("x");
  });

  test("rejects a resume token from an older version with a clear error", async () => {
    const error = await fetchWithX402(
      URL_A,
      {},
      {
        wallet: makeWallet(),
        resume: {
          pendingPayment: {
            scheme: "x402",
            header: "payment-signature",
            value: "legacy",
          } as never,
          preimage: PREIMAGE,
        },
      },
    ).catch((e) => e);

    expect((error as Error).message).toContain("older version");
    expect(fetchMock).not.toHaveBeenCalled();
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
