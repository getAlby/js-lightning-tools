import type { KeysendResponse } from "../types";

const TAG_KEYSEND = "keysend";

export type KeySendRawData = {
  tag: string;
  status: string;
  customData?: { customKey?: string; customValue?: string }[];
  pubkey: string;
};

export const parseKeysendResponse = (data: KeySendRawData): KeysendResponse => {
  if (data.tag !== TAG_KEYSEND) throw new Error("Invalid keysend params");
  if (data.status !== "OK") throw new Error("Keysend status not OK");
  if (!data.pubkey) throw new Error("Pubkey does not exist");

  const destination = data.pubkey;
  let customKey, customValue;

  if (data.customData && data.customData[0]) {
    customKey = data.customData[0].customKey;
    customValue = data.customData[0].customValue;
  }

  return {
    destination,
    customKey,
    customValue,
  };
};
