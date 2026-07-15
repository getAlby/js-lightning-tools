import {
  Fetch402Options,
  getInvoiceAmount,
  PaidResponse,
  payAndFetch,
  tryReusePayment,
  Wallet,
} from "../utils";
import { parseL402 } from "./utils";

export const handleL402Payment = async (
  l402Header: string,
  url: string,
  fetchArgs: RequestInit,
  headers: Headers,
  wallet: Wallet,
): Promise<PaidResponse> => {
  const details = parseL402(l402Header);
  const token = details.token || details.macaroon;
  const invoice = details.invoice;
  // Preserve the scheme the server challenged with (L402 or LSAT) so the
  // retry's Authorization header matches what the server expects.
  const scheme = /^\s*LSAT\b/i.test(l402Header) ? "LSAT" : "L402";

  if (!token) {
    throw new Error("L402: missing token/macaroon in WWW-Authenticate header");
  }
  if (!invoice) {
    throw new Error("L402: missing invoice in WWW-Authenticate header");
  }

  return payAndFetch({
    wallet,
    invoice,
    url,
    fetchArgs,
    headers,
    pendingPayment: {
      scheme: "l402",
      header: "Authorization",
      token,
      authScheme: scheme,
    },
    amount: getInvoiceAmount(invoice),
  });
};

export const fetchWithL402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: Fetch402Options,
): Promise<PaidResponse> => {
  const wallet = options.wallet;
  if (!wallet) {
    throw new Error("wallet is missing");
  }
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  const headers = new Headers(fetchArgs.headers ?? undefined);
  fetchArgs.headers = headers;

  // If the caller supplied a credential or a resume token, we MUST use it and
  // never pay again — even if the server still responds with a 402. Re-paying
  // here is the exact double-charge this API exists to prevent; the caller
  // decides what to do next (retry after settlement, top up, etc.).
  const reused = await tryReusePayment(url, fetchArgs, headers, options);
  if (reused) {
    return reused;
  }

  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("www-authenticate");
  if (!header) {
    return initResp;
  }

  return handleL402Payment(header, url, fetchArgs, headers, wallet);
};
