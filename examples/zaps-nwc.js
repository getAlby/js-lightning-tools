require('dotenv').config()
import { LightningAddress, NostrProvider } from "alby-tools";
import { webln } from "alby-js-sdk";
import 'websocket-polyfill';
import * as crypto from "crypto";
globalThis.crypto = crypto;

(async () => {

  const nostrWalletConnectUrl = process.env.NWC_URL;
  if (!nostrWalletConnectUrl) {
    throw new Error("Please add NWC_URL to .env. You can get one at nwc.getalby.com")
  }
  const nostrWeblnProvider = new webln.NostrWebLNProvider({ nostrWalletConnectUrl }) // loadNWCUrl() depending on your app. See alby-js-sdk readme
  const nostrProvider = {
    getPublicKey: () => Promise.resolve(nostrWeblnProvider.publicKey),
    signEvent: (event) => Promise.resolve({...event, sig: nostrWeblnProvider.signEvent(event)})
  }

  const ln = new LightningAddress("hello@getalby.com", {
    webln: nostrWeblnProvider,

  });
  await ln.fetch();
  
  if (!ln.nostrPubkey) {
    throw new Error('No nostr pubkey available'); // seems the lightning address is no NIP05 address
  }
  
  const zapArgs = {
    satoshi: 1000,
    comment: "Awesome post",
    relays: ["wss://relay.damus.io"],
    e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
  }
  
  const response = await ln.zap(zapArgs, {nostr: nostrProvider}); // generates a zap invoice
  console.log("Preimage", response.preimage); // print the preimage
  nostrWeblnProvider.close();
})();