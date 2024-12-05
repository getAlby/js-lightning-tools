const numSatsInBtc = 100_000_000;

export const getFiatBtcRate = async (currency: string): Promise<number> => {
  const url =
    "https://getalby.com/api/rates/" + currency.toLowerCase() + ".json";
  const response = await fetch(url);
  const data = await response.json();

  return data.rate_float / numSatsInBtc;
};

export const getFiatValue = async ({
  satoshi,
  currency,
}: {
  satoshi: number | string;
  currency: string;
}) => {
  const rate = await getFiatBtcRate(currency);

  return Number(satoshi) * rate;
};

export const getSatoshiValue = async ({
  amount,
  currency,
}: {
  amount: number | string;
  currency: string;
}) => {
  const rate = await getFiatBtcRate(currency);

  return Math.floor(Number(amount) / rate);
};

export const getFormattedFiatValue = async ({
  satoshi,
  currency,
  locale,
}: {
  satoshi: number | string;
  currency: string;
  locale: string;
}) => {
  if (!locale) {
    locale = "en";
  }
  const fiatValue = await getFiatValue({ satoshi, currency });
  return fiatValue.toLocaleString(locale, {
    style: "currency",
    currency,
  });
};

// Batch processing for efficient api usage
export const getBatchFiatValue = async ({
  satoshiArray,
  currency
}: {
  satoshiArray: number[] | string[];
  currency: string;
}) => {
  const rate = await getFiatBtcRate(currency);
  return satoshiArray.map((sat) => Number(sat) * rate);
};

export const getBatchSatoshiValue = async ({
  amountArray,
  currency,
}: {
  amountArray: number[] | string[];
  currency: string;
}) => {
  const rate = await getFiatBtcRate(currency);
  return amountArray.map((am) => Math.floor(Number(am) / rate));
};

export const getBatchFormattedFiatValue = async ({
  satoshiArray,
  currency,
  locale,
}: {
  satoshiArray: number[] | string[];
  currency: string;
  locale: string;
}) => {
  if (!locale) {
    locale = "en";
  }
  const fiatValues = await getBatchFiatValue({ satoshiArray, currency });
  return fiatValues.map((fv) =>
      fv.toLocaleString(locale, {
        style: "currency",
        currency,
      }),
  );
};


