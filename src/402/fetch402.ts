import { Wallet } from "./utils";
import { handleL402Payment } from "./l402/l402";
import { handleX402Payment } from "./x402/x402";
import { handleMppChargePayment } from "./mpp/mpp";

export const fetch402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    wallet: Wallet;
  },
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

  const wwwAuthHeader = initResp.headers.get("www-authenticate");
  if (wwwAuthHeader) {
    if (wwwAuthHeader.trimStart().toLowerCase().startsWith("payment")) {
      return handleMppChargePayment(
        wwwAuthHeader,
        url,
        fetchArgs,
        headers,
        wallet,
      );
    }
    return handleL402Payment(
      wwwAuthHeader,
      url,
      fetchArgs,
      headers,
      wallet,
      store,
      HEADER_KEY,
    );
  }

  const x402Header = initResp.headers.get("PAYMENT-REQUIRED");
  if (x402Header) {
    return handleX402Payment(x402Header, url, fetchArgs, headers, wallet);
  }

  return initResp;
};
