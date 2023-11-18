import { WebLNProvider } from "@webbtc/webln-types";

type BoostOptions = {
  webln?: unknown;
};

type BoostArguments = {
  destination: string;
  customKey?: string;
  customValue?: string;
  amount?: number;
  boost: Boost;
};

type WeblnBoostParams = {
  destination: string;
  amount: number;
  customRecords: Record<string, string>;
};

export type Boost = {
  action: string;
  value_msat: number;
  value_msat_total: number;
  app_name: string;
  app_version: string;
  feedId: string;
  podcast: string;
  episode: string;
  ts: number;
  name: string;
  sender_name: string;
};

export const boost = async (args: BoostArguments, options?: BoostOptions) => {
  const { boost } = args;
  if (!options) {
    options = {};
  }
  const webln: WebLNProvider = options.webln || globalThis.webln;

  if (!webln) {
    throw new Error("WebLN not available");
  }
  if (!webln.keysend) {
    throw new Error("Keysend not available in current WebLN provider");
  }

  const amount = args.amount || Math.floor(boost.value_msat / 1000);

  const weblnParams: WeblnBoostParams = {
    destination: args.destination,
    amount: amount,
    customRecords: {
      "7629169": JSON.stringify(boost),
    },
  };
  if (args.customKey && args.customValue) {
    weblnParams.customRecords[args.customKey] = args.customValue;
  }
  await webln.enable();
  const response = await webln.keysend(weblnParams);
  return response;
};

export default boost;
