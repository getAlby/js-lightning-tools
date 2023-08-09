
import { fetchWithL402 } from "@getalby/lightning-tools";
import { webln } from "alby-js-sdk";
import 'websocket-polyfill';
import * as crypto from "crypto";
globalThis.crypto = crypto;

const url = "https://lsat-weather-api.getalby.repl.co/kigali";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nostrWeblnProvider = new webln.NostrWebLNProvider({ nostrWalletConnectUrl })
nostrWeblnProvider.on('sendPayment', (response) => {
  console.log(`payment response:`, response);
});

fetchWithL402(url, {}, {webln: nostrWeblnProvider}).then(response => response.json()).then((data) => {
  console.log(data);
  nostrWeblnProvider.close();
})
