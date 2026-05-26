import { isBip21, parseBip21 } from "./utils";

describe("parseBip21", () => {
  test("returns null for non-bitcoin: input", () => {
    expect(parseBip21("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBeNull();
    expect(parseBip21("lightning:lnbc1u1pj...")).toBeNull();
    expect(parseBip21("")).toBeNull();
  });

  test("parses bare bitcoin: URI", () => {
    const result = parseBip21(
      "bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    );
    expect(result).toEqual({
      address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
      params: {},
      unknownRequiredParams: [],
    });
  });

  test("is case-insensitive on the scheme and preserves address case", () => {
    const result = parseBip21(
      "BITCOIN:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    );
    expect(result?.address).toBe("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  });

  test("parses amount and converts to sats", () => {
    const result = parseBip21("bitcoin:bc1q...?amount=0.001");
    expect(result?.amount).toBe(0.001);
    expect(result?.amountSats).toBe(100_000);
  });

  test("ignores invalid amount", () => {
    const result = parseBip21("bitcoin:bc1q...?amount=notanumber");
    expect(result?.amount).toBeUndefined();
    expect(result?.amountSats).toBeUndefined();
  });

  test("decodes label and message", () => {
    const result = parseBip21(
      "bitcoin:bc1q...?label=Luke-Jr&message=Donation%20for%20project%20xyz",
    );
    expect(result?.label).toBe("Luke-Jr");
    expect(result?.message).toBe("Donation for project xyz");
  });

  test("extracts unified-QR lightning fallback", () => {
    const result = parseBip21(
      "bitcoin:bc1q...?lightning=lnbc1u1pj4t6w0pp54wm83znxp8xly6qzuff",
    );
    expect(result?.lightning).toBe("lnbc1u1pj4t6w0pp54wm83znxp8xly6qzuff");
  });

  test("extracts BOLT12 offer from lno param", () => {
    const result = parseBip21("bitcoin:bc1q...?lno=lno1qcnq...");
    expect(result?.lno).toBe("lno1qcnq...");
  });

  test("flags unknown req-* params", () => {
    const result = parseBip21(
      "bitcoin:bc1q...?req-foo=bar&amount=0.5&req-label=ok",
    );
    // req-label is a required marker on a known param -> still safe
    expect(result?.unknownRequiredParams).toEqual(["req-foo"]);
    expect(result?.amount).toBe(0.5);
  });

  test("exposes raw params for custom use", () => {
    const result = parseBip21("bitcoin:bc1q...?custom=value&amount=0.01");
    expect(result?.params).toEqual({ custom: "value", amount: "0.01" });
  });

  test("trims whitespace around address", () => {
    const result = parseBip21(
      "bitcoin:  bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4  ",
    );
    expect(result?.address).toBe("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  });
});

describe("isBip21", () => {
  test("matches bitcoin: URIs case-insensitively", () => {
    expect(isBip21("bitcoin:bc1q...")).toBe(true);
    expect(isBip21("BITCOIN:bc1q...")).toBe(true);
    expect(isBip21("Bitcoin:bc1q...?amount=1")).toBe(true);
  });

  test("rejects non-BIP21 strings", () => {
    expect(isBip21("bc1q...")).toBe(false);
    expect(isBip21("lightning:lnbc1...")).toBe(false);
    expect(isBip21("")).toBe(false);
  });
});
