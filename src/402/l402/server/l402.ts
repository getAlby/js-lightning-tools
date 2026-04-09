export type MacaroonPayload<T> = T & {
  paymentHash: string; // hex — SHA256 of the preimage
};

export async function issueL402Macaroon<T extends Record<string, unknown>>(
  secret: string,
  paymentHash: string,
  params?: T,
): Promise<string> {
  if (
    params !== undefined &&
    Object.prototype.hasOwnProperty.call(params, "paymentHash")
  ) {
    throw new Error("paymentHash is reserved");
  }
  const payload = { ...params, paymentHash } as MacaroonPayload<T>;
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = await sign(secret, encoded);
  return `${encoded}.${mac}`;
}

export async function verifyL402Macaroon<T = unknown>(
  secret: string,
  token: string,
): Promise<MacaroonPayload<T>> {
  const { timingSafeEqual } = await import("crypto");
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) throw new Error("Invalid macaroon token");

  const encoded = token.slice(0, dotIndex);
  const mac = token.slice(dotIndex + 1);

  // Constant-time comparison to prevent timing attacks
  const expectedMac = await sign(secret, encoded);
  try {
    if (
      !timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expectedMac, "hex"))
    ) {
      throw new Error("Invalid macaroon token");
    }
  } catch (e) {
    throw new Error("Invalid macaroon token");
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      typeof (parsed as Record<string, unknown>).paymentHash !== "string"
    ) {
      throw new Error("Invalid macaroon payload");
    }
    return parsed as MacaroonPayload<T>;
  } catch {
    throw new Error("Invalid macaroon token");
  }
}

async function sign(secret: string, payload: string): Promise<string> {
  const { createHmac } = await import("crypto");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
