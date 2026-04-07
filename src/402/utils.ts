import { Invoice } from "../bolt11/Invoice";

export interface Wallet {
  payInvoice(args: { invoice: string }): Promise<{ preimage: string }>;
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
