import fetchMock from "jest-fetch-mock";
import {
  getFiatBtcRate,
  getFiatValue,
  getSatoshiValue,
  getFormattedFiatValue,
  FiatCurrency,
  getFiatCurrencies,
} from "./fiat";

const mockedRateResponse = {
  code: "USD",
  symbol: "$",
  rate: "100000.00",
  rate_float: 100000,
  rate_cents: 10000000,
  USD: {
    code: "USD",
    symbol: "$",
    rate: "100000.00",
    rate_float: 100000,
    rate_cents: 10000000,
  },
};

const mockRawApiResponse = {
  usd: {
    iso_code: "USD",
    name: "United States Dollar",
    priority: 1,
    symbol: "$",
  },
  eur: {
    iso_code: "EUR",
    name: "Euro",
    priority: 2,
    symbol: "€",
  },
  gbp: {
    iso_code: "GBP",
    name: "British Pound",
    priority: 3,
    symbol: "£",
  },
  // We add BTC here to test that the filter removes it
  btc: {
    iso_code: "BTC",
    name: "Bitcoin",
    priority: 100,
    symbol: "₿",
  },
};

const expectedOutput: FiatCurrency[] = [
  { code: "USD", name: "United States Dollar", priority: 1 },
  { code: "EUR", name: "Euro", priority: 2 },
  { code: "GBP", name: "British Pound", priority: 3 },
];

const satsInBtc = 100_000_000;
const rate = mockedRateResponse.rate_float;

beforeEach(() => {
  fetchMock.resetMocks();
});

describe("getFiatCurrencies", () => {
  it("returns a sorted, filtered list of currency objects", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockRawApiResponse));
    const result = await getFiatCurrencies();
    expect(result).toEqual(expectedOutput);

    // Verify BTC was filtered out
    expect(result.find((c) => c.code === "BTC")).toBeUndefined();
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ status: 500, error: "Internal Server Error" }),
      { status: 500, statusText: "Internal Server Error" },
    );

    await expect(getFiatCurrencies()).rejects.toThrow(
      "Failed to fetch currencies: 500 Internal Server Error",
    );
  });
});

describe("getFiatBtcRate", () => {
  it("returns BTC to fiat rate", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockedRateResponse));
    const result = await getFiatBtcRate("usd");
    expect(result).toBe(rate / satsInBtc);
  });

  it("throws on non-ok response", async () => {
    fetchMock.mockResponseOnce(
      JSON.stringify({ status: 404, error: "Not Found" }),
      { status: 404 },
    );

    await expect(getFiatBtcRate("non_existent")).rejects.toThrow(
      "Failed to fetch rate: 404 Not Found",
    );
  });
});

describe("getFiatValue", () => {
  it("converts sats to fiat", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockedRateResponse));
    const result = await getFiatValue({ satoshi: 1000, currency: "USD" });
    expect(result).toBe(1000 * (rate / satsInBtc));
  });
});

describe("getSatoshiValue", () => {
  it("converts fiat to sats", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockedRateResponse));
    const result = await getSatoshiValue({ amount: 1, currency: "USD" });
    expect(result).toBe(Math.floor(1 / (rate / satsInBtc)));
  });
});

describe("getFormattedFiatValue", () => {
  it("returns formatted fiat value", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockedRateResponse));
    const result = await getFormattedFiatValue({
      satoshi: 1000,
      currency: "USD",
      locale: "en-US",
    });
    expect(result).toBe(
      (1000 * (rate / satsInBtc)).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
    );
  });

  it("defaults to 'en' locale if not provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify(mockedRateResponse));
    const result = await getFormattedFiatValue({
      satoshi: 1000,
      currency: "USD",
      locale: "",
    });
    expect(result).toBe(
      (1000 * (rate / satsInBtc)).toLocaleString("en", {
        style: "currency",
        currency: "USD",
      }),
    );
  });
});
