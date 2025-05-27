import {
  KeySendRawData,
  KeysendResponse,
  Event,
  NostrResponse,
  ZapArgs,
  ZapOptions,
  LUD18ServicePayerData,
  LnUrlPayResponse,
  LnUrlRawData,
} from "./types";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const TAG_KEYSEND = "keysend";

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

export async function generateZapEvent(
  { satoshi, comment, p, e, relays }: ZapArgs,
  options: ZapOptions = {},
): Promise<Event> {
  const nostr = options.nostr || globalThis.nostr;
  if (!nostr) {
    throw new Error("nostr option or window.nostr is not available");
  }

  const nostrTags = [
    ["relays", ...relays],
    ["amount", satoshi.toString()],
  ];
  if (p) {
    nostrTags.push(["p", p]);
  }
  if (e) {
    nostrTags.push(["e", e]);
  }

  const pubkey = await nostr.getPublicKey();

  const nostrEvent: Event = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 9734,
    tags: nostrTags,
    content: comment ?? "",
  };

  nostrEvent.id = getEventHash(nostrEvent);
  return await nostr.signEvent(nostrEvent);
}

export function validateEvent(event: Event): boolean {
  if (typeof event.content !== "string") return false;
  if (typeof event.created_at !== "number") return false;
  // ignore these checks because if the pubkey is not set we add it to the event. same for the ID.
  // if (typeof event.pubkey !== "string") return false;
  // if (!event.pubkey.match(/^[a-f0-9]{64}$/)) return false;

  if (!Array.isArray(event.tags)) return false;
  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    if (!Array.isArray(tag)) return false;
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] === "object") return false;
    }
  }

  return true;
}

export function serializeEvent(evt: Event): string {
  if (!validateEvent(evt))
    throw new Error("can't serialize event with wrong or missing properties");

  return JSON.stringify([
    0,
    evt.pubkey,
    evt.created_at,
    evt.kind,
    evt.tags,
    evt.content,
  ]);
}

export function getEventHash(event: Event): string {
  return bytesToHex(sha256(serializeEvent(event)));
}

export function parseNostrResponse(
  nostrData: NostrResponse,
  username: string | undefined,
) {
  let nostrPubkey: string | undefined;
  let nostrRelays: string[] | undefined;
  if (username && nostrData) {
    nostrPubkey = nostrData.names?.[username];
    nostrRelays = nostrPubkey ? nostrData.relays?.[nostrPubkey] : undefined;
  }

  return [nostrData, nostrPubkey, nostrRelays] as const;
}

const URL_REGEX =
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/;

export const isUrl = (url: string | null): url is string => {
  if (!url) return false;
  return URL_REGEX.test(url);
};

export const isValidAmount = ({
  amount,
  min,
  max,
}: {
  amount: number;
  min: number;
  max: number;
}): boolean => {
  return amount > 0 && amount >= min && amount <= max;
};

const TAG_PAY_REQUEST = "payRequest";

// From: https://github.com/dolcalmi/lnurl-pay/blob/main/src/request-pay-service-params.ts
export const parseLnUrlPayResponse = async (
  data: LnUrlRawData,
): Promise<LnUrlPayResponse> => {
  if (data.tag !== TAG_PAY_REQUEST)
    throw new Error("Invalid pay service params");

  const callback = (data.callback + "").trim();
  if (!isUrl(callback)) throw new Error("Callback must be a valid url");

  const min = Math.ceil(Number(data.minSendable || 0));
  const max = Math.floor(Number(data.maxSendable));
  if (!(min && max) || min > max) throw new Error("Invalid pay service params");

  let metadata: Array<Array<string>>;
  let metadataHash: string;
  try {
    metadata = JSON.parse(data.metadata + "");
    metadataHash = bytesToHex(sha256(data.metadata + ""));
  } catch {
    metadata = [];
    metadataHash = bytesToHex(sha256("[]"));
  }

  let email = "";
  let image = "";
  let description = "";
  let identifier = "";
  for (let i = 0; i < metadata.length; i++) {
    const [k, v] = metadata[i];
    switch (k) {
      case "text/plain":
        description = v;
        break;
      case "text/identifier":
        identifier = v;
        break;
      case "text/email":
        email = v;
        break;
      case "image/png;base64":
      case "image/jpeg;base64":
        image = "data:" + k + "," + v;
        break;
    }
  }
  const payerData = data.payerData as LUD18ServicePayerData | undefined;

  let domain: string | undefined;
  try {
    domain = new URL(callback).hostname;
  } catch {
    // fail silently and let domain remain undefined if callback is not a valid URL
  }

  return {
    callback,
    fixed: min === max,
    min,
    max,
    domain,
    metadata,
    metadataHash,
    identifier,
    email,
    description,
    image,
    payerData,
    commentAllowed: Number(data.commentAllowed) || 0,
    rawData: data,
    allowsNostr: data.allowsNostr || false,
  };
};
