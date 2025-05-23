import { resolveAmount } from "../Amount";
import { USD } from "./FiatAmount";
import fetchMock from "jest-fetch-mock";

describe("FiatAmount", () => {
  test("interoperable with Amount", async () => {
    fetchMock.mockIf(/.*/, (_) => {
      return Promise.resolve(
        JSON.stringify({
          code: "USD",
          symbol: "$",
          rate: "77135.00",
          rate_float: 77135.0,
          rate_cents: 7713500,
          USD: {
            code: "USD",
            symbol: "$",
            rate: "77135.00",
            rate_float: 77135.0,
            rate_cents: 7713500,
          },
        }),
      );
    });
    const fiatAmount = USD(1);
    const resolved = await resolveAmount(fiatAmount);
    expect(resolved.satoshi).toBeGreaterThan(0);
  });
});
