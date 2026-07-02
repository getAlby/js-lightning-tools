export type Bip21 = {
  /** Bare on-chain bitcoin address (no scheme, no query string). */
  address: string;
  /** Requested amount in BTC, as defined by BIP21 (e.g. 0.01). */
  amount?: number;
  /** Requested amount converted to satoshis, for convenience. */
  amountSats?: number;
  /** Label for the recipient, decoded. */
  label?: string;
  /** Free-form message, decoded. */
  message?: string;
  /** BOLT11 invoice or LNURL, from the `lightning=` parameter (unified QR). */
  lightning?: string;
  /** BOLT12 offer, from the `lno=` parameter. */
  lno?: string;
  /**
   * `req-*` parameters that the client doesn't know how to handle.
   * Per BIP21, callers MUST reject the URI if this is non-empty.
   */
  unknownRequiredParams: string[];
  /** All query parameters, decoded, for advanced/custom use. */
  params: Record<string, string>;
};
