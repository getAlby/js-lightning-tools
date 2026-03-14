import { fetchWithX402 } from "@getalby/lightning-tools/l402";
import { NostrWebLNProvider } from "@getalby/sdk";
import "websocket-polyfill";

const url = "https://x402.albylabs.com/demo/quote";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nwc = new NostrWebLNProvider({
  nostrWalletConnectUrl,
});
await nwc.enable();
nwc.on("payInvoice", (response) => {
  console.info(`payment response:`, response);
});

fetchWithX402(url, {}, { wallet: nwc })
  .then((response) => response.json())
  .then((data) => {
    console.info(data);
    nwc.close();
  });
