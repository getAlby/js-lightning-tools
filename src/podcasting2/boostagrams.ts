import { WebLNProvider } from "@webbtc/webln-types";
import { BoostArguments, BoostOptions, WeblnBoostParams } from "./types";

export const sendBoostagram = async (
  args: BoostArguments,
  options?: BoostOptions,
) => {
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
