import { KVStorage, NoStorage, Wallet } from "./utils";
import { parseL402 } from "./l402/utils";
import { buildX402PaymentSignature, X402Requirements } from "./x402/utils";
import { HEADER_KEY } from "./l402/l402";

const noStorage = new NoStorage();

export const fetch402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    wallet: Wallet;
    store?: KVStorage;
  },
) => {
  const wallet = options.wallet;
  const store = options.store || noStorage;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  const headers = new Headers(fetchArgs.headers ?? undefined);
  fetchArgs.headers = headers;

  // Check cache — detect protocol from stored data structure
  const cachedRaw = store.getItem(url);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw);
    if (cached?.token && cached?.preimage) {
      // L402 cached
      headers.set(
        "Authorization",
        `${HEADER_KEY} ${cached.token}:${cached.preimage}`,
      );
      return await fetch(url, fetchArgs);
    }
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.invoice &&
      cached?.requirements
    ) {
      // X402 cached
      headers.set(
        "payment-signature",
        buildX402PaymentSignature(
          cached.scheme,
          cached.network,
          cached.invoice,
          cached.requirements,
        ),
      );
      return await fetch(url, fetchArgs);
    }
  }

  // Initial request — advertise L402 support
  headers.set("Accept-Authenticate", HEADER_KEY);
  const initResp = await fetch(url, fetchArgs);

  const l402Header = initResp.headers.get("www-authenticate");
  if (l402Header) {
    const details = parseL402(l402Header);
    const token = details.token || details.macaroon;
    const invoice = details.invoice;

    const invResp = await wallet.payInvoice!({ invoice });

    store.setItem(url, JSON.stringify({ token, preimage: invResp.preimage }));

    headers.set("Authorization", `${HEADER_KEY} ${token}:${invResp.preimage}`);

    return await fetch(url, fetchArgs);
  }

  const x402Header = initResp.headers.get("PAYMENT-REQUIRED");
  if (x402Header) {
    let parsed: { accepts?: unknown[] };
    try {
      parsed = JSON.parse(decodeURIComponent(escape(atob(x402Header))));
    } catch (_) {
      throw new Error(
        "x402: invalid PAYMENT-REQUIRED header (not valid base64-encoded JSON)",
      );
    }

    if (!Array.isArray(parsed.accepts) || parsed.accepts.length === 0) {
      throw new Error(
        "x402: PAYMENT-REQUIRED header contains no payment options",
      );
    }

    const requirements = (parsed.accepts as X402Requirements[]).find((e) => {
      return e.extra?.paymentMethod === "lightning";
    });
    if (!requirements) {
      throw new Error(
        "x402: unsupported x402 network, only lightning networks are supported",
      );
    }
    if (!requirements.extra?.invoice) {
      throw new Error("x402: payment requirements missing lightning invoice");
    }

    const invoice = requirements.extra.invoice;
    await wallet.payInvoice!({ invoice });

    store.setItem(
      url,
      JSON.stringify({
        scheme: requirements.scheme,
        network: requirements.network,
        invoice,
        requirements,
      }),
    );

    headers.set(
      "payment-signature",
      buildX402PaymentSignature(
        requirements.scheme,
        requirements.network,
        invoice,
        requirements,
      ),
    );
    return await fetch(url, fetchArgs);
  }

  return initResp;
};
