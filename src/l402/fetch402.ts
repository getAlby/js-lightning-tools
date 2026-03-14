import {
  KVStorage,
  NoStorage,
  parseL402,
  buildX402PaymentSignature,
  Wallet,
  X402Requirements,
} from "./utils";

const noStorage = new NoStorage();

const HEADER_KEY = "L402";

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
  if (!fetchArgs.headers) {
    fetchArgs.headers = {};
  }

  // Check cache — detect protocol from stored data structure
  const cachedRaw = store.getItem(url);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw);
    if (cached?.token && cached?.preimage) {
      // L402 cached
      fetchArgs.headers["Authorization"] =
        `${HEADER_KEY} ${cached.token}:${cached.preimage}`;
      return await fetch(url, fetchArgs);
    }
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.preimage &&
      cached?.requirements
    ) {
      // X402 cached
      fetchArgs.headers["payment-signature"] = buildX402PaymentSignature(
        cached.scheme,
        cached.network,
        cached.preimage,
        cached.requirements,
      );
      return await fetch(url, fetchArgs);
    }
  }

  // Initial request — advertise L402 support
  fetchArgs.headers["Accept-Authenticate"] = HEADER_KEY;
  const initResp = await fetch(url, fetchArgs);

  const l402Header = initResp.headers.get("www-authenticate");
  if (l402Header) {
    const details = parseL402(l402Header);
    const token = details.token || details.macaroon;
    const invoice = details.invoice;

    const invResp = await wallet.payInvoice!({ invoice });

    store.setItem(url, JSON.stringify({ token, preimage: invResp.preimage }));

    fetchArgs.headers["Authorization"] =
      `${HEADER_KEY} ${token}:${invResp.preimage}`;

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
      return e.network.startsWith("lightning");
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
    const invResp = await wallet.payInvoice!({ invoice });

    store.setItem(
      url,
      JSON.stringify({
        scheme: requirements.scheme,
        network: requirements.network,
        preimage: invResp.preimage,
        requirements,
      }),
    );

    fetchArgs.headers["payment-signature"] = buildX402PaymentSignature(
      requirements.scheme,
      requirements.network,
      invResp.preimage,
      requirements,
    );
    return await fetch(url, fetchArgs);
  }

  return initResp;
};
