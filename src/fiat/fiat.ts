const numSatsInBtc = 100_000_000;

export interface FiatCurrency {
  code: string;
  name: string;
  symbol: string;
  priority: number;
}

export const getFiatCurrencies = async (): Promise<FiatCurrency[]> => {
  const url = "https://getalby.com/api/rates";
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch currencies: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  const mappedCurrencies: FiatCurrency[] = Object.entries(data)
    .filter(([code]) => code.toUpperCase() !== "BTC")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map(([code, details]: any) => ({
      code: code.toUpperCase(),
      name: details.name,
      priority: details.priority,
      symbol: details.symbol,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort((a, b) => a.priority - b.priority) as FiatCurrency[];

  return mappedCurrencies;
};

export const getFiatBtcRate = async (currency: string): Promise<number> => {
  const url =
    "https://getalby.com/api/rates/" + currency.toLowerCase() + ".json";
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch rate: ${response.status} ${response.statusText}`,
    );
  }

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
