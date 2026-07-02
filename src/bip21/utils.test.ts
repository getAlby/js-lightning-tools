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

  test("trims surrounding whitespace before scheme detection", () => {
    const result = parseBip21(
      "  bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4  ",
    );
    expect(result?.address).toBe("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  });

  describe("BIP21 spec test vectors", () => {
    // Examples drawn from https://github.com/bitcoin/bips/blob/master/bip-0021.mediawiki

    test("just the address (spec example 1)", () => {
      const result = parseBip21("bitcoin:175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W");
      expect(result).toEqual({
        address: "175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W",
        params: {},
        unknownRequiredParams: [],
      });
    });

    test("address with label (spec example 2)", () => {
      const result = parseBip21(
        "bitcoin:175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W?label=Luke-Jr",
      );
      expect(result?.address).toBe("175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W");
      expect(result?.label).toBe("Luke-Jr");
    });

    test("address with amount and label (spec example 3)", () => {
      const result = parseBip21(
        "bitcoin:175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W?amount=20.3&label=Luke-Jr",
      );
      expect(result?.address).toBe("175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W");
      expect(result?.amount).toBe(20.3);
      expect(result?.amountSats).toBe(2_030_000_000);
      expect(result?.label).toBe("Luke-Jr");
    });

    test("address with amount, label, and message (spec example 4)", () => {
      const result = parseBip21(
        "bitcoin:175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W?amount=50&label=Luke-Jr&message=Donation%20for%20project%20xyz",
      );
      expect(result?.address).toBe("175tWpb8K1S7NmH4Zx6rewF9WQrcZv245W");
      expect(result?.amount).toBe(50);
      expect(result?.amountSats).toBe(5_000_000_000);
      expect(result?.label).toBe("Luke-Jr");
      expect(result?.message).toBe("Donation for project xyz");
    });
  });

  describe("strict BIP21 amount grammar", () => {
    // Per BIP21 ABNF: amountparam = "amount=" *digit [ "." *digit ]
    // We reject anything that isn't decimal-only.

    test.each([
      ["scientific notation", "1e-3"],
      ["hex", "0x10"],
      ["positive sign", "+1"],
      ["negative", "-1"],
      ["comma separator", "1,000"],
      ["trailing dot", "5."],
      ["leading dot", ".5"],
      ["whitespace", " 1 "],
      ["NaN", "NaN"],
      ["Infinity", "Infinity"],
      ["empty", ""],
    ])("rejects %s (%s)", (_label, raw) => {
      const result = parseBip21(
        `bitcoin:bc1q...?amount=${encodeURIComponent(raw)}`,
      );
      expect(result?.amount).toBeUndefined();
      expect(result?.amountSats).toBeUndefined();
    });
  });

  describe("exact decimal -> sats conversion", () => {
    test("integer BTC", () => {
      expect(parseBip21("bitcoin:bc1q...?amount=1")?.amountSats).toBe(
        100_000_000,
      );
      expect(parseBip21("bitcoin:bc1q...?amount=21000000")?.amountSats).toBe(
        2_100_000_000_000_000,
      );
    });

    test("one satoshi", () => {
      expect(parseBip21("bitcoin:bc1q...?amount=0.00000001")?.amountSats).toBe(
        1,
      );
    });

    test("avoids float imprecision (0.1 + 0.2 case)", () => {
      // 0.3 BTC in floats is 0.30000000000000004 — exact arithmetic must give 30_000_000 sats.
      expect(parseBip21("bitcoin:bc1q...?amount=0.3")?.amountSats).toBe(
        30_000_000,
      );
    });

    test("pads short fractional", () => {
      expect(parseBip21("bitcoin:bc1q...?amount=0.1")?.amountSats).toBe(
        10_000_000,
      );
    });

    test("rounds >8 fractional digits half-up to nearest sat", () => {
      // 0.000000015 BTC = 1.5 sat -> 2 sat
      expect(parseBip21("bitcoin:bc1q...?amount=0.000000015")?.amountSats).toBe(
        2,
      );
      // 0.000000014 BTC = 1.4 sat -> 1 sat
      expect(parseBip21("bitcoin:bc1q...?amount=0.000000014")?.amountSats).toBe(
        1,
      );
    });
  });
});

describe("isBip21", () => {
  test("matches bitcoin: URIs case-insensitively", () => {
    expect(isBip21("bitcoin:bc1q...")).toBe(true);
    expect(isBip21("BITCOIN:bc1q...")).toBe(true);
    expect(isBip21("Bitcoin:bc1q...?amount=1")).toBe(true);
  });

  test("matches after trimming surrounding whitespace", () => {
    expect(isBip21("  bitcoin:bc1q...  ")).toBe(true);
  });

  test("rejects non-BIP21 strings", () => {
    expect(isBip21("bc1q...")).toBe(false);
    expect(isBip21("lightning:lnbc1...")).toBe(false);
    expect(isBip21("")).toBe(false);
  });
});
