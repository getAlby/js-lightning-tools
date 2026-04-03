import { fetch402 } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";

// fetch402 works with L402, X402 and MPP endpoints —
// it detects the protocol from the server's response headers automatically.
const url = process.env.URL || "https://x402.albylabs.com/demo/quote";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nwc = new NWCClient({ nostrWalletConnectUrl });

fetch402(url, {}, { wallet: nwc })
  .then((response) => response.json())
  .then((data) => {
    console.info(data);
  })
  .finally(() => nwc.close());
