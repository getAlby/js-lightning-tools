import { parseL402 } from "./utils";

const BASE64_MAC =
  "AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ==";
const HEX_MAC =
  "jkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8x";
const HEX_INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";

describe("parseL402", () => {
  test("should correctly parse L402 string", () => {
    const testString = `L402 macaroon="${BASE64_MAC}", invoice="${HEX_INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: BASE64_MAC, invoice: HEX_INVOICE });
  });

  test("should correctly parse LSAT string", () => {
    const testString = `LSAT macaroon="${BASE64_MAC}", invoice="${HEX_INVOICE}"`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: BASE64_MAC, invoice: HEX_INVOICE });
  });

  test("should correctly handle unquoted values", () => {
    const testString = `L402 macaroon=${BASE64_MAC}, invoice=${HEX_INVOICE}`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: BASE64_MAC, invoice: HEX_INVOICE });
  });

  test("should correctly handle single-quoted values", () => {
    const testString = `LSAT macaroon='${BASE64_MAC}', invoice='${HEX_INVOICE}'`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: BASE64_MAC, invoice: HEX_INVOICE });
  });

  test("should correctly handle hexadecimal macaroon values", () => {
    const testString = `LSAT macaroon='${HEX_MAC}', invoice='${HEX_INVOICE}'`;
    const result = parseL402(testString);
    expect(result).toEqual({ macaroon: HEX_MAC, invoice: HEX_INVOICE });
  });
});
