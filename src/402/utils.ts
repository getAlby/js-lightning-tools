export interface Wallet {
  payInvoice(args: { invoice: string }): Promise<{ preimage: string }>;
}
