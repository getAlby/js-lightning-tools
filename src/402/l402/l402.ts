import { KVStorage, NoStorage, Wallet } from "../utils";
import { parseL402 } from "./utils";

const noStorage = new NoStorage();

export const HEADER_KEY = "L402";

export const fetchWithL402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    wallet: Wallet;
    headerKey?: string;
    store?: KVStorage;
  },
) => {
  const headerKey = options.headerKey || HEADER_KEY;
  const wallet = options.wallet;
  if (!wallet) {
    throw new Error("wallet is missing");
  }
  const store = options.store || noStorage;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  const headers = new Headers(fetchArgs.headers ?? undefined);
  fetchArgs.headers = headers;

  const cachedL402Data = store.getItem(url);
  if (cachedL402Data) {
    const data = JSON.parse(cachedL402Data);
    headers.set("Authorization", `${headerKey} ${data.token}:${data.preimage}`);
    return await fetch(url, fetchArgs);
  }

  headers.set("Accept-Authenticate", headerKey);
  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("www-authenticate");
  if (!header) {
    return initResp;
  }

  const details = parseL402(header);
  const token = details.token || details.macaroon;
  const invoice = details.invoice;

  const invResp = await wallet.payInvoice({ invoice });

  store.setItem(
    url,
    JSON.stringify({
      token: token,
      preimage: invResp.preimage,
    }),
  );

  headers.set("Authorization", `${headerKey} ${token}:${invResp.preimage}`);
  return await fetch(url, fetchArgs);
};
