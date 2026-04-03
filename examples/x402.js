import { fetchWithX402 } from "@getalby/lightning-tools/402/x402";
import { NWCClient } from "@getalby/sdk";

const url = process.env.URL || "https://x402.albylabs.com/demo/quote";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nwc = new NWCClient({ nostrWalletConnectUrl });

fetchWithX402(url, {}, { wallet: nwc })
  .then((response) => response.json())
  .then((data) => {
    console.info(data);
  })
  .finally(() => nwc.close());
