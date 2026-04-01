import { KVStorage, MemoryStorage, parseL402 } from "./utils";

const memoryStorage = new MemoryStorage();

const HEADER_KEY = "L402";

interface Wallet {
  sendPayment(paymentRequest: string): Promise<{ preimage: string }>;
}

export const fetchWithL402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    headerKey?: string;
    wallet?: Wallet;
    store?: KVStorage;
  },
) => {
  if (!options) {
    options = {};
  }
  const headerKey = options.headerKey || HEADER_KEY;
  const wallet: Wallet | undefined = options.wallet;
  if (!wallet) {
    throw new Error("wallet is missing");
  }
  const store = options.store || memoryStorage;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  if (!fetchArgs.headers) {
    fetchArgs.headers = {};
  }
  const cachedL402Data = store.getItem(url);
  if (cachedL402Data) {
    const data = JSON.parse(cachedL402Data);
    fetchArgs.headers["Authorization"] =
      `${headerKey} ${data.token}:${data.preimage}`;
    return await fetch(url, fetchArgs);
  }

  fetchArgs.headers["Accept-Authenticate"] = headerKey;
  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("www-authenticate");
  if (!header) {
    return initResp;
  }

  const details = parseL402(header);
  const token = details.token || details.macaroon;
  const inv = details.invoice;

  const invResp = await wallet.sendPayment(inv);

  store.setItem(
    url,
    JSON.stringify({
      token: token,
      preimage: invResp.preimage,
    }),
  );

  fetchArgs.headers["Authorization"] =
    `${headerKey} ${token}:${invResp.preimage}`;
  return await fetch(url, fetchArgs);
};

export type MacaroonPayload<T> = T & {
  paymentHash: string; // hex — SHA256 of the preimage
};

export async function issueL402Macaroon<T = unknown>(
  secret: string,
  paymentHash: string,
  params: T,
): Promise<string> {
  const payload: MacaroonPayload<T> = {
    paymentHash,
    ...params,
  };
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
    return JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as MacaroonPayload<T>;
  } catch {
    throw new Error("Invalid macaroon token");
  }
}

async function sign(secret: string, payload: string): Promise<string> {
  const { createHmac } = await import("crypto");
  return createHmac("sha256", secret).update(payload).digest("hex");
}
