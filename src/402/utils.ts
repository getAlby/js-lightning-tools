import { Invoice } from "../bolt11/Invoice";
import { buildMppCredential, MppChallenge } from "./mpp/utils";

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
 * An interrupted payment that can be resumed once its preimage is recovered.
 *
 * When `wallet.payInvoice` times out, the payment may still have settled but the
 * preimage is lost — so the credential (which embeds the preimage) can't be
 * built yet. This opaque, fully-serializable token captures everything else the
 * library needs; hand it back via `options.resume` together with the recovered
 * preimage and the library rebuilds the credential internally, without paying
 * again. Treat it as opaque: don't read or construct its fields yourself.
 *
 * It is plain data (no functions), so it survives `JSON.stringify` and can be
 * forwarded across process/CLI boundaries.
 */
export type PendingPayment =
  | {
      scheme: "l402";
      header: string;
      /** The macaroon/token from the L402 challenge. */
      token: string;
      /** The challenge scheme, preserved so the retry header matches. */
      authScheme: "L402" | "LSAT";
    }
  | {
      scheme: "mpp";
      header: string;
      /** The parsed MPP challenge, echoed into the credential. */
      challenge: MppChallenge;
    }
  | {
      scheme: "x402";
      header: string;
      /** The x402 payment signature — independent of the preimage. */
      value: string;
    };

/**
 * Rebuild a scheme's {@link PaymentCredentials} from a {@link PendingPayment}
 * and its recovered preimage. Internal: callers reach this via `options.resume`,
 * never directly.
 */
const buildCredentials = (
  pendingPayment: PendingPayment,
  preimage: string,
): PaymentCredentials => {
  switch (pendingPayment.scheme) {
    case "l402":
      return {
        header: pendingPayment.header,
        value: `${pendingPayment.authScheme} ${pendingPayment.token}:${preimage}`,
      };
    case "mpp":
      return {
        header: pendingPayment.header,
        value: `Payment ${buildMppCredential(pendingPayment.challenge, preimage)}`,
      };
    case "x402":
      // x402's signature does not embed the preimage; it is already complete.
      return { header: pendingPayment.header, value: pendingPayment.value };
  }
};

/**
 * Payment metadata attached (as `response.payment`) to responses returned by
 * the 402 fetch helpers.
 */
export interface PaymentInfo {
  /** Whether a lightning payment was made to obtain this response. */
  paid: boolean;
  /** Amount of the paid invoice, in satoshis (0 when `paid` is false). */
  amountSat: number;
  /** Routing fees paid, in millisatoshis, when reported by the wallet. */
  feesPaidMsat?: number;
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
  /**
   * Resume a payment that was interrupted by a timeout. When `payInvoice` throws
   * (see {@link Fetch402InterruptedError} with `paid: false`) the payment may still
   * have settled; look the payment up in your wallet by `paymentHash`, and if it
   * settled pass the recovered `preimage` back here together with the error's
   * `pendingPayment`. The helper rebuilds the credential and sends the request
   * WITHOUT paying again.
   */
  resume?: {
    pendingPayment: PendingPayment;
    preimage: string;
  };
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
  credentials ? { paid: false, amountSat: 0, credentials } : undefined;

/**
 * If the caller supplied a reusable `credentials` or a `resume` token, apply it
 * and send the request WITHOUT paying. Returns the finished response, or `null`
 * when neither was supplied (so the caller proceeds to the normal pay flow).
 *
 * Both paths carry the guarantee the 402 helpers exist to provide: once you hand
 * back a credential or a resumed payment, the library never pays a second time.
 */
export const tryReusePayment = async (
  url: string,
  fetchArgs: RequestInit,
  headers: Headers,
  options: Fetch402Options,
): Promise<PaidResponse | null> => {
  if (options.credentials) {
    applyCredentials(headers, options.credentials);
    const response = await fetch(url, fetchArgs);
    return attachPayment(
      response,
      reusedCredentialPayment(options.credentials),
    );
  }
  if (options.resume) {
    const { pendingPayment, preimage } = options.resume;
    const credentials = buildCredentials(pendingPayment, preimage);
    applyCredentials(headers, credentials);
    const response = await fetch(url, fetchArgs);
    // The payment already happened (earlier); this request itself does not pay.
    return attachPayment(response, {
      paid: false,
      amountSat: 0,
      preimage,
      credentials,
    });
  }
  return null;
};

/** Satoshi amount of a BOLT11 invoice (0 when it cannot be decoded). */
export const getInvoiceAmount = (invoice: string): number => {
  try {
    return new Invoice({ pr: invoice }).satoshi;
  } catch (_) {
    return 0;
  }
};

/** Payment hash of a BOLT11 invoice (empty string when it cannot be decoded). */
export const getPaymentHash = (invoice: string): string => {
  try {
    return new Invoice({ pr: invoice }).paymentHash;
  } catch (_) {
    return "";
  }
};

/**
 * Thrown when a payment was ATTEMPTED but the request flow then failed, leaving
 * the caller without a `Response`. It carries everything needed to reconcile the
 * payment WITHOUT paying the same invoice again — the exact double-charge the
 * 402 helpers exist to prevent.
 *
 * - `paid: false` — `wallet.payInvoice` itself rejected. The payment may still
 *   have settled (e.g. a wallet timeout). Look up `paymentHash` in your wallet;
 *   if it settled, pass the recovered preimage and `pendingPayment` back via
 *   `options.resume` (the library rebuilds the credential) instead of re-paying.
 * - `paid: true` — the invoice was paid but the follow-up request failed (e.g. a
 *   network error reaching the resource). Retry with `credentials` (already
 *   built) instead of paying again.
 *
 * All fields are plain data so the error survives `JSON.stringify` and can be
 * forwarded across process/CLI boundaries. Note: after such a round-trip the
 * value is a plain object, so match on `name === "Fetch402InterruptedError"` (or
 * the presence of `paymentHash`) rather than `instanceof`.
 */
export class Fetch402InterruptedError extends Error {
  /** Discriminator that survives serialization (`instanceof` does not). */
  readonly name = "Fetch402InterruptedError";
  /** The invoice that was paid (or attempted). */
  readonly invoice: string;
  /** Payment hash decoded from the invoice; use it to look up settlement. */
  readonly paymentHash: string;
  /** Amount of the invoice in satoshis, decoded from it (0 when it cannot be decoded). */
  readonly amountSat: number;
  /** Whether `wallet.payInvoice` reported success before the failure. */
  readonly paid: boolean;
  /** Payment preimage, present when the invoice was paid. */
  readonly preimage?: string;
  /** Routing fees in millisatoshis, present when `paid` and reported by the wallet. */
  readonly feesPaidMsat?: number;
  /** Reusable credential, present when `paid` (already built for you). */
  readonly credentials?: PaymentCredentials;
  /**
   * The interrupted payment. When `paid` is false, pass this back via
   * `options.resume` with the recovered preimage to finish without re-paying.
   */
  readonly pendingPayment: PendingPayment;
  /** The underlying error that caused the failure. */
  readonly cause?: unknown;

  constructor(
    message: string,
    details: {
      invoice: string;
      paid: boolean;
      pendingPayment: PendingPayment;
      preimage?: string;
      feesPaidMsat?: number;
      credentials?: PaymentCredentials;
      cause?: unknown;
    },
  ) {
    super(message);
    this.invoice = details.invoice;
    this.paymentHash = getPaymentHash(details.invoice);
    this.amountSat = getInvoiceAmount(details.invoice);
    this.paid = details.paid;
    this.preimage = details.preimage;
    this.feesPaidMsat = details.feesPaidMsat;
    this.credentials = details.credentials;
    this.pendingPayment = details.pendingPayment;
    this.cause = details.cause;
  }
}

/**
 * Shared tail of every 402 handler: pay the invoice, apply the resulting
 * credential, retry the request, and attach payment metadata. Any failure
 * during or after payment is rethrown as {@link Fetch402InterruptedError} so a
 * thrown error never loses the paid invoice/credential and the caller can
 * reconcile instead of paying twice.
 */
export const payAndFetch = async (args: {
  wallet: Wallet;
  invoice: string;
  url: string;
  fetchArgs: RequestInit;
  headers: Headers;
  /** How to build the credential once the preimage is known. */
  pendingPayment: PendingPayment;
  /** Invoice amount in satoshis, for the attached PaymentInfo. */
  amountSat: number;
}): Promise<PaidResponse> => {
  const {
    wallet,
    invoice,
    url,
    fetchArgs,
    headers,
    pendingPayment,
    amountSat,
  } = args;

  let invResp: { preimage: string; fees_paid?: number };
  try {
    invResp = await wallet.payInvoice({ invoice });
  } catch (cause) {
    // Payment may or may not have settled (e.g. a wallet timeout). Surface the
    // paymentHash (to look up settlement) and the pendingPayment (to resume from
    // a recovered preimage via options.resume) so the caller need never re-pay.
    throw new Fetch402InterruptedError(
      "402: payInvoice failed; look up paymentHash before retrying to avoid double payment",
      { invoice, paid: false, pendingPayment, cause },
    );
  }

  const credentials = buildCredentials(pendingPayment, invResp.preimage);
  headers.set(credentials.header, credentials.value);

  let response: Response;
  try {
    response = await fetch(url, fetchArgs);
  } catch (cause) {
    // The invoice is already paid — a retry MUST reuse these credentials rather
    // than pay again.
    throw new Fetch402InterruptedError(
      "402: request after payment failed; retry with credentials instead of paying again",
      {
        invoice,
        paid: true,
        pendingPayment,
        preimage: invResp.preimage,
        feesPaidMsat: invResp.fees_paid,
        credentials,
        cause,
      },
    );
  }

  return attachPayment(response, {
    paid: true,
    amountSat,
    feesPaidMsat: invResp.fees_paid,
    preimage: invResp.preimage,
    credentials,
  });
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
