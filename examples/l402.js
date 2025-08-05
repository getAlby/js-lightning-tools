import { fetchWithL402 } from "@getalby/lightning-tools/l402";
import { NostrWebLNProvider } from "@getalby/sdk";
import "websocket-polyfill";

const url = "https://lsat-weather-api.getalby.repl.co/kigali";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nostrWeblnProvider = new NostrWebLNProvider({
  nostrWalletConnectUrl,
});
nostrWeblnProvider.on("sendPayment", (response) => {
  console.info(`payment response:`, response);
});

fetchWithL402(url, {}, { webln: nostrWeblnProvider })
  .then((response) => response.json())
  .then((data) => {
    console.info(data);
    nostrWeblnProvider.close();
  });
