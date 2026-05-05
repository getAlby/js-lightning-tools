import fetchMock from "jest-fetch-mock";
import { fetch402 } from "./fetch402";
import {
  encodeMppChargeRequest,
  makeMppWwwAuthenticateHeader,
} from "./mpp/utils";

const INVOICE =
  "lnbc4020n1p5m6028dq80q6rqvsnp4qt5w34u6kntf5lc50jj27rvs89sgrpcpj7s6vfts042gkhxx2j6swpp5g6tquvmswkv5xf0ru7ju2qvdrf83l2ewha3qzzt0a7vurs5q30rssp54kt5hfzjngjersx8fgt60feuu8e7vnat67f3ksr98twdj7z0m0ls9qyysgqcqzp2xqyz5vqrzjqdc22wfv6lyplagj37n9dmndkrzdz8rh3lxkewvvk6arkjpefats2rf47yqqwysqqcqqqqlgqqqqqqgqfqrzjq26922n6s5n5undqrf78rjjhgpcczafws45tx8237y7pzx3fg8ww8apyqqqqqqqqjyqqqqlgqqqqr4gq2q3z5pu33awfm98ac3ysdhy046xmen4zqval67tccu35x9mxgvl6w3wmq6y03ae7pme6qr20mp5gvuqntnu8yy7nlf6gyt9zshanj2zhgqe4xde3";
const PREIMAGE =
  "8196e90022ce688d911554d02af67d3d6a72143961c1e1aa12c4720538ea0549";

const URL = "https://example.com/protected";

const LIGHTNING_REQUIREMENTS = {
  scheme: "exact",
  network: "bip122:000000000019d6689c085ae165831e93",
  amount: "402000",
  asset: "BTC",
  payTo: "anonymous",
  extra: { paymentMethod: "lightning", invoice: INVOICE },
};

const USDC_REQUIREMENTS = {
  scheme: "exact",
  network: "eip155:8453",
  amount: "100000",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0xd5f8481D8F25d3966d2010DBf9B47fFbdf745A9E",
  extra: { name: "USD Coin", version: "2" },
};

function paymentRequiredHeader(accepts: unknown[]): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ accepts }))));
}

function makeWallet(preimage: string = PREIMAGE) {
  return { payInvoice: jest.fn().mockResolvedValue({ preimage }) };
}

beforeEach(() => {
  fetchMock.resetMocks();
});

describe("fetch402 dispatcher", () => {
  test("pays lightning offer in PAYMENT-REQUIRED with mixed USDC + lightning accepts", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": paymentRequiredHeader([
          USDC_REQUIREMENTS,
          LIGHTNING_REQUIREMENTS,
        ]),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ paid: true }), { status: 200 });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    expect(response.status).toBe(200);
  });

  test("falls through unknown WWW-Authenticate Payment method to x402 lightning offer", async () => {
    // Asterpay-style: Payment method="asterpay" alongside x402 PAYMENT-REQUIRED
    // with both USDC and lightning entries. We don't speak `method=asterpay`,
    // so we must fall through to x402 and pay the lightning entry.
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "WWW-Authenticate":
          'Payment id="abc", realm="example.com", method="asterpay", intent="charge", request="eyJhIjoxfQ"',
        "PAYMENT-REQUIRED": paymentRequiredHeader([
          USDC_REQUIREMENTS,
          LIGHTNING_REQUIREMENTS,
        ]),
      },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ paid: true }), { status: 200 });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    expect(response.status).toBe(200);
  });

  test("returns original 402 when no payable lightning offer is present", async () => {
    // USDC-only endpoint: a non-lightning wallet would handle this. We pass
    // the original 402 back to the caller so they can act on it themselves.
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": paymentRequiredHeader([USDC_REQUIREMENTS]),
      },
    });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns original 402 when only an unknown WWW-Authenticate Payment method is present", async () => {
    // Pure MPP-USDC challenge with no lightning fallback: dispatcher must
    // pass the response through, not throw "unsupported scheme".
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "WWW-Authenticate":
          'Payment id="abc", realm="example.com", method="asterpay", intent="charge", request="eyJhIjoxfQ"',
      },
    });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
  });

  test("returns original 402 when PAYMENT-REQUIRED accepts contains a malformed entry", async () => {
    // Malformed accepts entry (e.g., null) must not throw — the dispatcher
    // probes for a payable lightning offer and falls through when none is found.
    const wallet = makeWallet();

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": paymentRequiredHeader([null]),
      },
    });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(response.status).toBe(402);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("pays MPP-lightning challenge when method=lightning intent=charge", async () => {
    const wallet = makeWallet();

    const wwwAuth = makeMppWwwAuthenticateHeader({
      id: "id123",
      realm: "example.com",
      request: encodeMppChargeRequest({
        amount: "10",
        currency: "sat",
        methodDetails: { invoice: INVOICE },
      }),
    });

    fetchMock.mockResponseOnce("Payment Required", {
      status: 402,
      headers: { "WWW-Authenticate": wwwAuth },
    });
    fetchMock.mockResponseOnce(JSON.stringify({ paid: true }), { status: 200 });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE });
    expect(response.status).toBe(200);
  });

  test("returns 200 unchanged when there is no 402", async () => {
    const wallet = makeWallet();

    fetchMock.mockResponseOnce(JSON.stringify({ free: true }), { status: 200 });

    const response = await fetch402(URL, {}, { wallet });

    expect(wallet.payInvoice).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
