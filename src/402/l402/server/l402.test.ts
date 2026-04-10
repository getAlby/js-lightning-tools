const MACAROON =
  "AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ==";
const INVOICE =
  "lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz";
const PREIMAGE =
  "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

import { makeL402AuthenticateHeader, parseL402Authorization } from "./utils";
import { issueL402Macaroon, verifyL402Macaroon } from "./l402";

// ---------------------------------------------------------------------------
// makeL402AuthenticateHeader
// ---------------------------------------------------------------------------
describe("makeL402AuthenticateHeader", () => {
  test("produces correct L402 header with token", () => {
    const TOKEN = "sometoken";
    const header = makeL402AuthenticateHeader({
      token: TOKEN,
      invoice: INVOICE,
    });
    expect(header).toBe(
      `L402 version="0" token="${TOKEN}", invoice="${INVOICE}"`,
    );
  });

  test("throws when token is not provided", () => {
    expect(() => makeL402AuthenticateHeader({ invoice: INVOICE })).toThrow(
      "token must be provided",
    );
  });
});

// ---------------------------------------------------------------------------
// parseL402Authorization
// ---------------------------------------------------------------------------
describe("parseL402Authorization", () => {
  test("parses valid L402 authorization header", () => {
    const input = `L402 ${MACAROON}:${PREIMAGE}`;
    const result = parseL402Authorization(input);
    expect(result).toEqual({ token: MACAROON, preimage: PREIMAGE });
  });

  test("returns null when key does not match", () => {
    const input = `Bearer ${MACAROON}:${PREIMAGE}`;
    expect(parseL402Authorization(input)).toBeNull();
  });

  test("parses valid LSAT authorization header (backwards compat)", () => {
    const input = `LSAT ${MACAROON}:${PREIMAGE}`;
    const result = parseL402Authorization(input);
    expect(result).toEqual({ token: MACAROON, preimage: PREIMAGE });
  });

  test("throws when colon separator is missing", () => {
    const input = `L402 ${MACAROON}`;
    expect(() => parseL402Authorization(input)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// issueL402Macaroon / verifyL402Macaroon
// ---------------------------------------------------------------------------
describe("issueL402Macaroon / verifyL402Macaroon", () => {
  const SECRET = "test-secret";
  const PAYMENT_HASH = "abc123";

  test("issues a token and verifies it successfully", async () => {
    const token = await issueL402Macaroon(SECRET, PAYMENT_HASH, {});
    const payload = await verifyL402Macaroon(SECRET, token);
    expect(payload).not.toBeNull();
    expect(payload?.paymentHash).toBe(PAYMENT_HASH);
  });

  test("includes custom params in the payload", async () => {
    const token = await issueL402Macaroon(SECRET, PAYMENT_HASH, {
      service: "premium",
      tier: 2,
    });
    const payload = await verifyL402Macaroon<{ service: string; tier: number }>(
      SECRET,
      token,
    );
    expect(payload?.service).toBe("premium");
    expect(payload?.tier).toBe(2);
    expect(payload?.paymentHash).toBe(PAYMENT_HASH);
  });

  test("throws when verified with wrong secret", async () => {
    const token = await issueL402Macaroon(SECRET, PAYMENT_HASH, {});
    await expect(verifyL402Macaroon("wrong-secret", token)).rejects.toThrow(
      "Invalid macaroon token",
    );
  });

  test("throws for a tampered token", async () => {
    const token = await issueL402Macaroon(SECRET, PAYMENT_HASH, {});
    const tampered = token.slice(0, -4) + "0000";
    await expect(verifyL402Macaroon(SECRET, tampered)).rejects.toThrow(
      "Invalid macaroon token",
    );
  });

  test("throws for a token with no dot separator", async () => {
    await expect(verifyL402Macaroon(SECRET, "nodothere")).rejects.toThrow(
      "Invalid macaroon token",
    );
  });

  test("throws for a token with invalid base64 payload", async () => {
    const invalidPayload = "!!!.deadbeef";
    await expect(verifyL402Macaroon(SECRET, invalidPayload)).rejects.toThrow(
      "Invalid macaroon token",
    );
  });

  test("throws when params contains reserved paymentHash key", async () => {
    await expect(
      issueL402Macaroon(SECRET, PAYMENT_HASH, { paymentHash: "other" }),
    ).rejects.toThrow("paymentHash is reserved");
  });

  test("does not throw when params is omitted", async () => {
    await expect(
      issueL402Macaroon(SECRET, PAYMENT_HASH),
    ).resolves.toBeDefined();
  });
});
