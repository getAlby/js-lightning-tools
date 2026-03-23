import { KVStorage, NoStorage, Wallet } from "../utils";
import { buildX402PaymentSignature, X402Requirements } from "./utils";
import { Invoice } from "../../bolt11";

const noStorage = new NoStorage();

export const fetchWithX402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: { wallet: Wallet; store?: KVStorage },
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

  const cachedRaw = store.getItem(url);
  if (cachedRaw) {
    let cached: {
      scheme: string;
      network: string;
      invoice: string;
      requirements: X402Requirements;
    } | null = null;
    cached = JSON.parse(cachedRaw);
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.invoice &&
      cached?.requirements
    ) {
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
    return e.extra.paymentMethod === "lightning";
  });
  if (!requirements) {
    throw new Error(
      "x402: unsupported x402 network, only Bitcoin lightning network is supported.",
    );
  }
  if (!requirements.extra?.invoice) {
    throw new Error("x402: payment requirements missing lightning invoice");
  }

  const invoice = new Invoice({ pr: requirements.extra.invoice });
  if (invoice.amountRaw != requirements.amount) {
    throw new Error(
      `Invalid invoice amount: ${invoice.amountRaw}. expected ${requirements.amount}`,
    );
  }

  await wallet.payInvoice!({ invoice: invoice.paymentRequest });

  store.setItem(
    url,
    JSON.stringify({
      scheme: requirements.scheme,
      network: requirements.network,
      invoice: invoice.paymentRequest,
      requirements,
    }),
  );

  headers.set(
    "payment-signature",
    buildX402PaymentSignature(
      requirements.scheme,
      requirements.network,
      invoice.paymentRequest,
      requirements,
    ),
  );
  return await fetch(url, fetchArgs);
};
