import { Invoice } from "../../bolt11/Invoice";
import { validatePreimage } from "../../bolt11/utils";

export interface X402Requirements {
  scheme: string;
  network: string;
  extra: {
    invoice: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * PAYMENT-SIGNATURE for the `exact` scheme on `lnbtc`: proves payment with the
 * invoice preimage. The paid invoice stays in `accepted.extra.invoice`.
 */
export const buildLnbtcPaymentSignature = (
  accepted: X402Requirements,
  walletPreimage: string,
): string => {
  // The wire format requires lowercase hex; some wallets return uppercase.
  const preimage = walletPreimage.toLowerCase();
  const { paymentHash } = new Invoice({ pr: accepted.extra.invoice });
  if (
    !/^[0-9a-f]{64}$/.test(preimage) ||
    !validatePreimage(preimage, paymentHash)
  ) {
    throw new Error(
      `x402: invalid_exact_lnbtc_payer_preimage_hash_mismatch: wallet returned a preimage that does not match payment hash ${paymentHash}`,
    );
  }
  const json = JSON.stringify({
    x402Version: 2,
    accepted,
    payload: { preimage },
  });
  // btoa only handles latin1; encode via UTF-8 to be safe
  return btoa(unescape(encodeURIComponent(json)));
};
