import { Event, NostrResponse, ZapArgs, ZapOptions } from "../types";
import { sha256 } from "./sha256";

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

  nostrEvent.id = await getEventHash(nostrEvent);
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

export function getEventHash(event: Event): Promise<string> {
  return sha256(serializeEvent(event));
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
