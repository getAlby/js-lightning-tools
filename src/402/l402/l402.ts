import { Wallet } from "../utils";
import { parseL402 } from "./utils";

export const handleL402Payment = async (
  l402Header: string,
  url: string,
  fetchArgs: RequestInit,
  headers: Headers,
  wallet: Wallet,
): Promise<Response> => {
  const details = parseL402(l402Header);
  const token = details.token || details.macaroon;
  const invoice = details.invoice;

  if (!token) {
    throw new Error("L402: missing token/macaroon in WWW-Authenticate header");
  }
  if (!invoice) {
    throw new Error("L402: missing invoice in WWW-Authenticate header");
  }

  const invResp = await wallet.payInvoice({ invoice });
  headers.set("Authorization", `L402 ${token}:${invResp.preimage}`);
  return fetch(url, fetchArgs);
};

export const fetchWithL402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    wallet: Wallet;
  },
) => {
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

  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("www-authenticate");
  if (!header) {
    return initResp;
  }

  return handleL402Payment(header, url, fetchArgs, headers, wallet);
};
