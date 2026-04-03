import { fetchWithMpp } from "@getalby/lightning-tools/402/mpp";
import { NWCClient } from "@getalby/sdk";

const url = process.env.URL || "https://api.ppq.ai/v1/data/api/exa/answer";

const nostrWalletConnectUrl = process.env.NWC_URL;

if (!nostrWalletConnectUrl) {
  throw new Error("Please set a NWC_URL env variable");
}

const nwc = new NWCClient({ nostrWalletConnectUrl });

fetchWithMpp(
  url,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "What is the Lightning Network?" }),
  },
  { wallet: nwc },
)
  .then((response) => response.json())
  .then((data) => {
    console.info(JSON.stringify(data, null, 2));
  })
  .catch((err) => {
    console.error("Error:", err.message);
  })
  .finally(() => nwc.close());
