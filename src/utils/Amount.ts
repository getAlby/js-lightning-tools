/**
 * An amount in satoshis
 */
export type Amount = { satoshi: number } | { satoshi: Promise<number> };

export const SATS: (amount: number) => Amount = (amount) => ({
  satoshi: amount,
});

/**
 * Resolve a satoshi amount, possibly from a promise (e.g. from fiat conversion)
 */
export async function resolveAmount(
  amount: Amount,
): Promise<{ satoshi: number; millisat: number }> {
  const satoshi = await Promise.resolve(amount.satoshi);

  return {
    satoshi: satoshi,
    millisat: satoshi * 1000,
  };
}
