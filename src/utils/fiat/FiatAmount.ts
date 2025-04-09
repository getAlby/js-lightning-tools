import { fiat } from "../..";

/**
 * An amount in a fiat currency represented in satoshis
 */
export class FiatAmount {
  satoshi: Promise<number>;
  constructor(amount: number, currency: string) {
    this.satoshi = fiat.getSatoshiValue({
      amount,
      currency,
    });
  }
}

// Most popular fiat currencies
export const USD = (amount: number) => new FiatAmount(amount, "USD");
export const EUR = (amount: number) => new FiatAmount(amount, "EUR");
export const JPY = (amount: number) => new FiatAmount(amount, "JPY");
export const GBP = (amount: number) => new FiatAmount(amount, "GBP");
export const CHF = (amount: number) => new FiatAmount(amount, "CHF");
