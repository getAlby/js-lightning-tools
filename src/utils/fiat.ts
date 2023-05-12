import fetch from '@inrupt/universal-fetch';

const numSatsInBtc = 100_000_000;

export const getFiatBtcRate = async (currency: string): Promise<number> => {
  const url = "https://getalby.com/api/rates/" + currency.toLowerCase() + ".json";
  const response = await fetch(url);
  const data = await response.json();

  return data.rate_float / numSatsInBtc;
};

export const getFiatValue = async ({ satoshi, currency }: { satoshi: number | string; currency: string; }) => {
  const rate = await getFiatBtcRate(currency);

  return Number(satoshi) * rate;
};

export const getSatoshiValue = async ({ amount, currency }: { amount: number | string; currency: string; }) => {
  const rate = await getFiatBtcRate(currency);

  return Math.floor(Number(amount) / rate);
}

export const getFormattedFiatValue = async ({ satoshi, currency, locale }: { satoshi: number | string; currency: string; locale: string }) => {
  if (!locale) {
    locale = 'en';
  }
  const fiatValue = await getFiatValue({ satoshi, currency });
  return fiatValue.toLocaleString(locale, {
    style: "currency",
    currency,
  });
}