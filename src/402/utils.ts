import { Invoice } from "../bolt11/Invoice";

export interface Wallet {
  payInvoice(args: { invoice: string }): Promise<{ preimage: string }>;
}

/**
 * Credentials returned after a successful 402 payment.
 * Use `headerName` / `headerValue` to authenticate follow-up requests
 * to the same origin (e.g. HLS segment fetches after paying for a stream).
 */
export interface Fetch402Credentials {
  /** The protocol that was used: "l402", "x402", or "mpp". */
  type: "l402" | "x402" | "mpp";
  /** Header name to set on subsequent requests (e.g. "Authorization"). */
  headerName: string;
  /** Header value to set on subsequent requests. */
  headerValue: string;
}

/**
 * Result returned by fetch402 and related helpers.
 * Replaces the bare Response so callers can reuse the payment credentials.
 */
export interface Fetch402Result {
  response: Response;
  /** Present when a payment was made; undefined for non-402 responses. */
  credentials?: Fetch402Credentials;
}

export function createGuardedWallet(
  wallet: Wallet,
  maxAmountSats: number,
): Wallet {
  return {
    payInvoice: async (args: { invoice: string }) => {
      const invoice = new Invoice({ pr: args.invoice });
      if (invoice.satoshi > maxAmountSats) {
        throw new Error(
          `Invoice amount (${invoice.satoshi} sats) exceeds maxAmount (${maxAmountSats} sats)`,
        );
      }
      return wallet.payInvoice(args);
    },
  };
}
