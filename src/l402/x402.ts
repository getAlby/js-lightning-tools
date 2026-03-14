import {
  KVStorage,
  NoStorage,
  buildX402PaymentSignature,
  Wallet,
  X402Requirements,
} from "./utils";

const noStorage = new NoStorage();

export const fetchWithX402 = async (
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

  const cachedRaw = store.getItem(url);
  if (cachedRaw) {
    let cached: {
      scheme: string;
      network: string;
      preimage: string;
      requirements: X402Requirements;
    } | null = null;
    cached = JSON.parse(cachedRaw);
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.preimage &&
      cached?.requirements
    ) {
      fetchArgs.headers["payment-signature"] = buildX402PaymentSignature(
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
};
