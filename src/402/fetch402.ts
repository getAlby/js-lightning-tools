import { KVStorage, NoStorage, Wallet } from "./utils";
import { buildX402PaymentSignature } from "./x402/utils";
import { HEADER_KEY, handleL402Payment } from "./l402/l402";
import { handleX402Payment } from "./x402/x402";

const noStorage = new NoStorage();

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
  const headers = new Headers(fetchArgs.headers ?? undefined);
  fetchArgs.headers = headers;

  // Check cache — detect protocol from stored data structure
  const cachedRaw = store.getItem(url);
  if (cachedRaw) {
    const cached = JSON.parse(cachedRaw);
    if (cached?.token && cached?.preimage) {
      // L402 cached
      headers.set(
        "Authorization",
        `${HEADER_KEY} ${cached.token}:${cached.preimage}`,
      );
      return await fetch(url, fetchArgs);
    }
    if (
      cached?.scheme &&
      cached?.network &&
      cached?.invoice &&
      cached?.requirements
    ) {
      // X402 cached
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

  // Initial request — advertise L402 support
  headers.set("Accept-Authenticate", HEADER_KEY);
  const initResp = await fetch(url, fetchArgs);

  const l402Header = initResp.headers.get("www-authenticate");
  if (l402Header) {
    return handleL402Payment(l402Header, url, fetchArgs, headers, wallet, store, HEADER_KEY);
  }

  const x402Header = initResp.headers.get("PAYMENT-REQUIRED");
  if (x402Header) {
    return handleX402Payment(x402Header, url, fetchArgs, headers, wallet, store);
  }

  return initResp;
};
