import { Wallet } from "../utils";
import {
  buildMppCredential,
  decodeBase64url,
  MppChargeRequest,
  parseMppChallenge,
} from "./utils";

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
): Promise<Response> => {
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

  const invResp = await wallet.payInvoice({ invoice });

  // Per spec: Authorization: Payment <base64url-token>  (single token, no wrapper)
  const credential = buildMppCredential(challenge, invResp.preimage);
  headers.set("Authorization", `Payment ${credential}`);

  return fetch(url, fetchArgs);
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
 * Note: lightning-charge uses consume-once challenge semantics – each
 * challenge embeds a fresh invoice, so paid credentials cannot be reused.
 * The `store` option is accepted for API consistency but is not used.
 */
export const fetchWithMpp = async (
  url: string,
  fetchArgs: RequestInit,
  options: { wallet: Wallet },
): Promise<Response> => {
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
  const wwwAuthHeader = initResp.headers.get("www-authenticate");
  if (
    !wwwAuthHeader ||
    !wwwAuthHeader.trimStart().toLowerCase().startsWith("payment")
  ) {
    return initResp;
  }

  return handleMppChargePayment(wwwAuthHeader, url, fetchArgs, headers, wallet);
};
