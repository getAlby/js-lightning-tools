import fetch from 'cross-fetch';

const numSatsInBtc = 100_000_000;

const getFiatBtcRate = async (currency: string): Promise<number> => {
  const response = await fetch(
    `https://getalby.com/api/rates/${currency.toLowerCase()}.json`
  );
  const data = await response.json();

  return data.rate_float / numSatsInBtc;
};

export const getFiatValue = async ({ amount, currency}: {  amount: number | string; currency: string; }) => {
  const rate = await getFiatBtcRate(currency);

  return Number(amount) * rate;
};

export const getFormattedFiatValue = async ({ amount, currency}: {  amount: number | string; currency: string; }) => {
  const fiatValue = await getFiatValue({ amount, currency });
  return fiatValue.toLocaleString("en", {
    style: "currency",
    currency,
  });
}
