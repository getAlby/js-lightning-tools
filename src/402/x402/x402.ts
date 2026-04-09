import { Wallet } from "../utils";
import { buildX402PaymentSignature, X402Requirements } from "./utils";
import { Invoice } from "../../bolt11";

export const handleX402Payment = async (
  x402Header: string,
  url: string,
  fetchArgs: RequestInit,
  headers: Headers,
  wallet: Wallet,
): Promise<Response> => {
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

  headers.set(
    "payment-signature",
    buildX402PaymentSignature(
      requirements.scheme,
      requirements.network,
      invoice.paymentRequest,
      requirements,
    ),
  );
  return fetch(url, fetchArgs);
};

export const fetchWithX402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: { wallet: Wallet },
) => {
  const wallet = options.wallet;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  const headers = new Headers(fetchArgs.headers ?? undefined);
  fetchArgs.headers = headers;

  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("PAYMENT-REQUIRED");
  if (!header) {
    return initResp;
  }

  return handleX402Payment(header, url, fetchArgs, headers, wallet);
};
