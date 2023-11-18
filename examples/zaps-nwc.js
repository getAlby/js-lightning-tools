import { LightningAddress } from "@getalby/lightning-tools";
import { webln } from "alby-js-sdk";
import "websocket-polyfill";
import * as crypto from "crypto";
import { finishEvent, getPublicKey } from "nostr-tools";
/*global globalThis*/
globalThis.crypto = crypto;

// your private key is required to sign zap request events
const nostrPrivateKey = process.env.NOSTR_PRIVATE_KEY;
// NWC url will be used to pay the zap invoice.
// It can be created in advanced at nwc.getalby.com,
// or use webln.NostrWebLNProvider.withNewSecret() to generate a new one
const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrPrivateKey || !nostrWalletConnectUrl) {
  throw new Error("Please set .env variables");
}

(async () => {
  const nostrWeblnProvider = new webln.NostrWebLNProvider({
    nostrWalletConnectUrl,
  });
  // or use nostrWeblnProvider.initNWC(); to get a new NWC url
  const nostrProvider = {
    getPublicKey: () => Promise.resolve(getPublicKey(nostrPrivateKey)),
    signEvent: (event) => Promise.resolve(finishEvent(event, nostrPrivateKey)),
  };

  const ln = new LightningAddress("hello@getalby.com", {
    webln: nostrWeblnProvider,
  });
  await ln.fetch();

  if (!ln.nostrPubkey) {
    throw new Error("No nostr pubkey available"); // seems the lightning address is no NIP05 address
  }

  const zapArgs = {
    satoshi: 1000,
    comment: "Awesome post",
    relays: ["wss://relay.damus.io"],
    e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  };

  const response = await ln.zap(zapArgs, { nostr: nostrProvider }); // generates a zap invoice
  console.log("Preimage", response.preimage); // print the preimage
  nostrWeblnProvider.close();
})();
