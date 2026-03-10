import { KVStorage, MemoryStorage } from "./utils";

const memoryStorage = new MemoryStorage();

interface Wallet {
  sendPayment?(paymentRequest: string): Promise<{ preimage: string }>;
  payInvoice?(paymentRequest: string): Promise<{ preimage: string }>;
}

interface X402Requirements {
  scheme: string;
  network: string;
  extra: {
    invoice: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const buildPaymentSignature = (
  scheme: string,
  network: string,
  preimage: string,
  requirements: X402Requirements,
): string => {
  const json = JSON.stringify({
    x402Version: 2,
    scheme,
    network,
    payload: { preimage },
    accepted: requirements,
  });
  // btoa only handles latin1; encode via UTF-8 to be safe
  return btoa(unescape(encodeURIComponent(json)));
};

export const fetchWithX402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    wallet?: Wallet;
    store?: KVStorage;
  },
) => {
  if (!options) {
    options = {};
  }
  const wallet: Wallet | undefined = options.wallet;
  if (!wallet) {
    throw new Error("wallet is missing");
  }
  if (!wallet.sendPayment && !wallet.payInvoice) {
    throw new Error("wallet must have a sendPayment or payInvoice function");
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

  const cachedRaw = store.getItem(url);
  if (cachedRaw) {
    let cached: {
      scheme: string;
      network: string;
      preimage: string;
      requirements: X402Requirements;
    } | null = null;
    try {
      cached = JSON.parse(cachedRaw);
    } catch (_) {
      // corrupt cache entry — fall through to fresh request
      store.setItem(url, null as unknown as string);
    }
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.preimage &&
      cached?.requirements
    ) {
      fetchArgs.headers["payment-signature"] = buildPaymentSignature(
        cached.scheme,
        cached.network,
        cached.preimage,
        cached.requirements,
      );
      return await fetch(url, fetchArgs);
    }
  }

  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("PAYMENT-REQUIRED");
  if (!header) {
    return initResp;
  }

  let parsed: { accepts?: unknown[] };
  try {
    parsed = JSON.parse(decodeURIComponent(escape(atob(header))));
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
  const payFn =
    wallet.sendPayment?.bind(wallet) ?? wallet.payInvoice!.bind(wallet);
  const invResp = await payFn(invoice);

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
};
