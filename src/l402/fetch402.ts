import { KVStorage, NoStorage, parseL402 } from "./utils";
import { buildPaymentSignature, X402Requirements } from "./x402";

const noStorage = new NoStorage();

const HEADER_KEY = "L402";

interface Wallet {
  sendPayment?(paymentRequest: string): Promise<{ preimage: string }>;
  payInvoice?(args: { invoice: string }): Promise<{ preimage: string }>;
}

export const fetch402 = async (
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
  if (!wallet.sendPayment && !wallet.payInvoice) {
    throw new Error("wallet must have a sendPayment or payInvoice function");
  }
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
        `${headerKey} ${cached.token}:${cached.preimage}`;
      return await fetch(url, fetchArgs);
    }
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.preimage &&
      cached?.requirements
    ) {
      // X402 cached
      fetchArgs.headers["payment-signature"] = buildPaymentSignature(
        cached.scheme,
        cached.network,
        cached.preimage,
        cached.requirements,
      );
      return await fetch(url, fetchArgs);
    }
  }

  // Initial request — advertise L402 support
  fetchArgs.headers["Accept-Authenticate"] = headerKey;
  const initResp = await fetch(url, fetchArgs);

  const l402Header = initResp.headers.get("www-authenticate");
  if (l402Header) {
    const details = parseL402(l402Header);
    const token = details.token || details.macaroon;
    const inv = details.invoice;

    const invResp = wallet.sendPayment
      ? await wallet.sendPayment(inv)
      : await wallet.payInvoice!({ invoice: inv });

    store.setItem(url, JSON.stringify({ token, preimage: invResp.preimage }));

    fetchArgs.headers["Authorization"] =
      `${headerKey} ${token}:${invResp.preimage}`;
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

    const requirements = parsed.accepts[0] as X402Requirements;
    if (!requirements.extra?.invoice) {
      throw new Error("x402: payment requirements missing invoice");
    }
    if (!requirements.scheme || !requirements.network) {
      throw new Error("x402: payment requirements missing scheme or network");
    }
    if (!requirements.network.startsWith("lightning")) {
      throw new Error(
        `x402: unsupported network "${requirements.network}", only lightning networks are supported`,
      );
    }

    const invoice = requirements.extra.invoice;
    const invResp = wallet.sendPayment
      ? await wallet.sendPayment(invoice)
      : await wallet.payInvoice!({ invoice });

    if (!invResp?.preimage) {
      throw new Error("x402: wallet did not return a preimage");
    }

    store.setItem(
      url,
      JSON.stringify({
        scheme: requirements.scheme,
        network: requirements.network,
        preimage: invResp.preimage,
        requirements,
      }),
    );

    fetchArgs.headers["payment-signature"] = buildPaymentSignature(
      requirements.scheme,
      requirements.network,
      invResp.preimage,
      requirements,
    );
    return await fetch(url, fetchArgs);
  }

  return initResp;
};
