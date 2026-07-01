import { Invoice } from "../bolt11/Invoice";

export interface Wallet {
  payInvoice(args: {
    invoice: string;
  }): Promise<{ preimage: string; fees_paid?: number }>;
}

/**
 * A reusable payment credential. After a successful paid request the credential
 * is attached to the response (see {@link PaymentInfo}). Pass it back via
 * `options.credentials` on a follow-up request (e.g. polling a long-running
 * job) to authorize the request without paying again.
 *
 * `header` is the HTTP header the credential is sent in (`Authorization` for
 * L402/MPP, `payment-signature` for x402) and `value` is the header value.
 */
export interface PaymentCredentials {
  header: string;
  value: string;
}

/**
 * Payment metadata attached (as `response.payment`) to responses returned by
 * the 402 fetch helpers.
 */
export interface PaymentInfo {
  /** Whether a lightning payment was made to obtain this response. */
  paid: boolean;
  /** Amount of the paid invoice, in satoshis (0 when `paid` is false). */
  amount: number;
  /** Routing fees paid, in millisatoshis, when reported by the wallet. */
  feesPaid?: number;
  /** Payment preimage, present when a payment was made. */
  preimage?: string;
  /**
   * Reusable credential. Pass it back via `options.credentials` on a follow-up
   * request (e.g. polling) to authorize it without paying again.
   */
  credentials: PaymentCredentials;
}

/** A `Response` with optional payment metadata attached by the 402 helpers. */
export type PaidResponse = Response & { payment?: PaymentInfo };

/** Options accepted by the 402 fetch helpers. */
export interface Fetch402Options {
  wallet: Wallet;
  /**
   * A credential returned by a previous paid request. When provided it is
   * applied to the request and the helper NEVER pays again — even if the server
   * still responds with a 402 (that response is returned to the caller as-is).
   * Use it to authorize follow-up requests (e.g. polling) without re-paying.
   */
  credentials?: PaymentCredentials;
}

/** Apply a previously-obtained credential to the outgoing request headers. */
export const applyCredentials = (
  headers: Headers,
  credentials: PaymentCredentials,
): void => {
  headers.set(credentials.header, credentials.value);
};

/** Attach payment metadata to a response and return it (typed). */
export const attachPayment = (
  response: Response,
  payment: PaymentInfo | undefined,
): PaidResponse => {
  if (payment) {
    (response as PaidResponse).payment = payment;
  }
  return response;
};

/** Payment metadata describing a request authorized with a reused credential. */
export const reusedCredentialPayment = (
  credentials: PaymentCredentials | undefined,
): PaymentInfo | undefined =>
  credentials ? { paid: false, amount: 0, credentials } : undefined;

/** Satoshi amount of a BOLT11 invoice (0 when it cannot be decoded). */
export const getInvoiceAmount = (invoice: string): number => {
  try {
    return new Invoice({ pr: invoice }).satoshi;
  } catch (_) {
    return 0;
  }
};

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
