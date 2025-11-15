const numSatsInBtc = 100_000_000;

interface CurrencyDetails {
  priority: number;
  iso_code: string;
  name: string;
  symbol: string;
  alternate_symbols: string[];
  subunit: string;
  subunit_to_unit: number;
  symbol_first: boolean;
  format: string;
  html_entity: string;
  decimal_mark: string;
  thousands_separator: string;
  iso_numeric: string;
  smallest_denomination: number;
  disambiguate_symbol?: string;
}
type CurrencyData = Record<string, CurrencyDetails>;

export const getFiatCurrencies = async (): Promise<string[]> => {
  const url = "https://getalby.com/api/rates";
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch currencies: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as CurrencyData;

  return Object.values(data).map((currency) => currency.iso_code);
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
