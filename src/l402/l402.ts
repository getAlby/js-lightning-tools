import { KVStorage, MemoryStorage, parseL402 } from "./utils";

const memoryStorage = new MemoryStorage();

const HEADER_KEY = "L402";

interface Wallet {
  sendPayment(paymentRequest: string): Promise<{ preimage: string }>;
}

export const fetchWithL402 = async (
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
  const store = options.store || memoryStorage;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  if (!fetchArgs.headers) {
    fetchArgs.headers = {};
  }
  const cachedL402Data = store.getItem(url);
  if (cachedL402Data) {
    const data = JSON.parse(cachedL402Data);
    fetchArgs.headers["Authorization"] =
      `${headerKey} ${data.token}:${data.preimage}`;
    return await fetch(url, fetchArgs);
  }

  fetchArgs.headers["Accept-Authenticate"] = headerKey;
  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get("www-authenticate");
  if (!header) {
    return initResp;
  }

  const details = parseL402(header);
  const token = details.token || details.macaroon;
  const inv = details.invoice;

  const invResp = await wallet.sendPayment(inv);

  store.setItem(
    url,
    JSON.stringify({
      token: token,
      preimage: invResp.preimage,
    }),
  );

  fetchArgs.headers["Authorization"] =
    `${headerKey} ${token}:${invResp.preimage}`;
  return await fetch(url, fetchArgs);
};
