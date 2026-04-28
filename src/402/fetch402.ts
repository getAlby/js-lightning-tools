import { Wallet, createGuardedWallet } from "./utils";
import { handleL402Payment } from "./l402/l402";
import { findX402LightningRequirements, handleX402Payment } from "./x402/x402";
import { handleMppChargePayment } from "./mpp/mpp";
import { parseMppChallenge } from "./mpp/utils";

export const fetch402 = async (
  url: string,
  fetchArgs: RequestInit,
  options: {
    wallet: Wallet;
    maxAmount?: number;
  },
) => {
  const wallet = options.maxAmount
    ? createGuardedWallet(options.wallet, options.maxAmount)
    : options.wallet;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = "no-store";
  fetchArgs.mode = "cors";
  const headers = new Headers(fetchArgs.headers ?? undefined);
  fetchArgs.headers = headers;

  const initResp = await fetch(url, fetchArgs);

  // L402 / LSAT: dedicated scheme, dispatch directly.
  const wwwAuthHeader = initResp.headers.get("www-authenticate");
  if (wwwAuthHeader) {
    const trimmed = wwwAuthHeader.trimStart().toLowerCase();
    if (trimmed.startsWith("l402") || trimmed.startsWith("lsat")) {
      return handleL402Payment(wwwAuthHeader, url, fetchArgs, headers, wallet);
    }
  }

  // A server may advertise multiple payment options at once (e.g. an MPP
  // USDC challenge in WWW-Authenticate alongside an x402 PAYMENT-REQUIRED
  // header that lists both USDC and lightning). Try each lightning-payable
  // handler in turn; only if none matches do we hand the original 402 back
  // to the caller so they can decide what to do with non-lightning offers.

  // 1. MPP-lightning challenge (Payment method="lightning" intent="charge").
  //    parseMppChallenge returns null for any other method, which lets us
  //    fall through to x402 instead of throwing.
  if (wwwAuthHeader && parseMppChallenge(wwwAuthHeader)) {
    return handleMppChargePayment(
      wwwAuthHeader,
      url,
      fetchArgs,
      headers,
      wallet,
    );
  }

  // 2. x402 PAYMENT-REQUIRED with a lightning entry in `accepts`.
  const x402Header = initResp.headers.get("PAYMENT-REQUIRED");
  if (x402Header && findX402LightningRequirements(x402Header)) {
    return handleX402Payment(x402Header, url, fetchArgs, headers, wallet);
  }

  return initResp;
};
