import { fetchWithL402 } from "@getalby/lightning-tools/402/l402";
import { NWCClient } from "@getalby/sdk";

const url = process.env.URL || "https://l402.example.com/protected-resource";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nwc = new NWCClient({ nostrWalletConnectUrl });

fetchWithL402(url, {}, { wallet: nwc })
  .then((response) => response.json())
  .then((data) => {
    console.info(data);
  })
  .finally(() => nwc.close());
