import {
  Fetch402Options,
  getInvoiceAmount,
  PaidResponse,
  payAndFetch,
  tryReusePayment,
  Wallet,
} from "../utils";
import { decodeBase64url, MppChargeRequest, parseMppChallenge } from "./utils";

/**
 * Handle a `WWW-Authenticate: Payment …` challenge produced by a
 * draft-lightning-charge-00 server.
 *
 * Flow:
 *  1. Parse the challenge from the header.
 *  2. Decode the `request` auth-param to find the BOLT11 invoice.
 *  3. Pay the invoice via the wallet; receive the HTLC preimage.
 *  4. Build the `Authorization: Payment <credential>` header.
 *  5. Retry the original request with the credential.
 */
export const handleMppChargePayment = async (
  wwwAuthHeader: string,
  url: string,
  fetchArgs: RequestInit,
  headers: Headers,
  wallet: Wallet,
): Promise<PaidResponse> => {
  const challenge = parseMppChallenge(wwwAuthHeader);
  if (!challenge) {
    throw new Error(
      "mpp: invalid or unsupported WWW-Authenticate challenge (expected Payment method=lightning intent=charge)",
    );
  }

  let request: MppChargeRequest;
  try {
    request = JSON.parse(decodeBase64url(challenge.request));
  } catch (_) {
    throw new Error(
      "mpp: invalid request auth-param (not valid base64url-encoded JSON)",
    );
  }

  const invoice = request.methodDetails?.invoice;
  if (!invoice) {
    throw new Error("mpp: missing invoice in charge request");
  }

  return payAndFetch({
    wallet,
    invoice,
    url,
    fetchArgs,
    headers,
    pendingPayment: { scheme: "mpp", header: "Authorization", challenge },
    amountSat: getInvoiceAmount(invoice),
  });
};

/**
 * Fetch a resource protected by the draft-lightning-charge-00 payment
 * authentication protocol.
 *
 * On a `402 Payment Required` response that carries a
 * `WWW-Authenticate: Payment method="lightning" intent="charge" …` header
 * the function pays the embedded BOLT11 invoice and retries with the
 * resulting preimage as the credential.
 *
 * Pass a previous credential via `options.credentials` to reuse it (e.g. when
 * polling); the credential is applied and the function NEVER pays again, even
 * if the server still responds with a 402 (that response is returned as-is).
 * Note: lightning-charge typically uses consume-once challenge semantics, so a
 * reused credential is only accepted by servers that explicitly support it.
 */
export const fetchWithMpp = async (
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
  const wwwAuthHeader = initResp.headers.get("www-authenticate");
  if (
    !wwwAuthHeader ||
    !wwwAuthHeader.trimStart().toLowerCase().startsWith("payment")
  ) {
    return initResp;
  }

  return handleMppChargePayment(wwwAuthHeader, url, fetchArgs, headers, wallet);
};
