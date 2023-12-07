import { isUrl, isValidAmount, parseLnUrlPayResponse } from "./lnurl";

describe("isValidAmount", () => {
  test("amount must be in range", () => {
    expect(isValidAmount({ amount: 0, min: 1, max: 2 })).toBe(false);
    expect(isValidAmount({ amount: 3, min: 1, max: 2 })).toBe(false);
    expect(isValidAmount({ amount: 0, min: 1, max: 1 })).toBe(false);
    expect(isValidAmount({ amount: 2, min: 1, max: 1 })).toBe(false);
    expect(isValidAmount({ amount: 1, min: 1, max: 2 })).toBe(true);
    expect(isValidAmount({ amount: 2, min: 1, max: 2 })).toBe(true);
    expect(isValidAmount({ amount: 1, min: 1, max: 1 })).toBe(true);
    expect(isValidAmount({ amount: 1, min: 0, max: 2 })).toBe(true);
  });
});

describe("isUrl", () => {
  test("url must be a valid http URL", () => {
    expect(
      isUrl(
        "lnurl1dp68gurn8ghj7em9w3skccne9e3k7mf0d3h82unvwqhksetvd3hj7cmpd3kxyctrdvlkzmt0w4h8g0f3xqcrqvpssx932j",
      ),
    ).toBe(false);
    expect(
      isUrl("https://getalby.com/lnurlp/hello/callback?amount=100000"),
    ).toBe(true);
  });
});

describe("parseLnUrlPayResponse", () => {
  test("min/max must be in millisats", async () => {
    const response = {
      status: "OK",
      tag: "payRequest",
      commentAllowed: 255,
      callback: "https://getalby.com/lnurlp/hello/callback",
      metadata:
        '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
      minSendable: 1000,
      maxSendable: 11000000000,
      payerData: { name: { mandatory: false }, email: { mandatory: false } },
      nostrPubkey:
        "79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432",
      allowsNostr: true,
    };
    const parsed = await parseLnUrlPayResponse(response);
    expect(parsed.min).toBe(1000);
    expect(parsed.max).toBe(11000000000);
  });
  // TODO: add more tests
});
