import type { KeysendResponse } from "../types";

const TAG_KEYSEND = "keysend";

export const parseKeysendResponse = (
  data: Record<string, any>,
): KeysendResponse => {
  if (data.tag !== TAG_KEYSEND) throw new Error("Invalid keysend params");
  if (data.status !== "OK") throw new Error("Keysend status not OK");

  if (
    !("customKey" in data.customData[0]) ||
    data.customData[0]["customKey"] != "696969"
  )
    throw new Error("Unable to find customKey");

  if (
    !("customValue" in data.customData[0]) ||
    !data.customData[0]["customValue"]
  )
    throw new Error("Unable to find customValue");

  if (!data.pubkey) throw new Error("Pubkey does not exist");

  const destination = data.pubkey;
  const customKey = data.customData[0]["customKey"];
  const customValue = data.customData[0]["customValue"];

  return {
    destination,
    customKey,
    customValue,
  };
};
