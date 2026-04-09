<p align="center">
  <img width="100%" src="docs/Header.png">
</p>

# Lightning Web SDK

An npm package that provides useful and common tools and helpers to build lightning web applications.

Before you start coding, look at example scenarios in our **[Developer Sandbox](https://sandbox.albylabs.com/)**

## 🤖 🚀 ⚡ For Developers using Agents / LLMs / Vibe Coding

Skip the rest of this README and use the [Alby Bitcoin Builder Skill](https://github.com/getAlby/builder-skill) instead. It will handle the rest!

## Manual Installation

```
npm install @getalby/lightning-tools
```

or

```
yarn add @getalby/lightning-tools
```

or for use without any build tools:

```html
<script type="module">
  import { LightningAddress } from "https://esm.sh/@getalby/lightning-tools@7"; // jsdelivr.net, skypack.dev also work

  // use LightningAddress normally...
  (async () => {
    const ln = new LightningAddress("hello@getalby.com");
    // fetch the LNURL data
    await ln.fetch();
    // get the LNURL-pay data:
    console.log(ln.lnurlpData);
  })();
</script>
```

**This library relies on a global `fetch()` function which will work in [browsers](https://caniuse.com/?search=fetch) and node v18 or newer.** (In older versions you have to use a polyfill.)

## 🤙 Usage

### Lightning Address

The `LightningAddress` class provides helpers to work with lightning addresses

```js
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

const ln = new LightningAddress("hello@getalby.com");

// fetch the LNURL data
await ln.fetch();

// get the LNURL-pay data:
console.log(ln.lnurlpData); // returns a [LNURLPayResponse](https://github.com/getAlby/js-lightning-tools/blob/master/src/types.ts#L1-L15)
// get the keysend data:
console.log(ln.keysendData);
```

#### Get an invoice:

```js
import { LightningAddress } from "@getalby/lightning-tools/lnurl";

const ln = new LightningAddress("hello@getalby.com");

await ln.fetch();
// request an invoice for 1000 satoshis
// this returns a new `Invoice` class that can also be used to validate the payment
const invoice = await ln.requestInvoice({ satoshi: 1000 });

console.log(invoice.paymentRequest); // print the payment request
console.log(invoice.paymentHash); // print the payment hash
```

#### Verify a payment

```js
import { LightningAddress } from "@getalby/lightning-tools/lnurl";
const ln = new LightningAddress("hello@getalby.com");
await ln.fetch();

const invoice = await ln.requestInvoice({ satoshi: 1000 });

// if the LNURL providers supports LNURL-verify:
const paid = await invoice.verifyPayment(); // returns true of false
if (paid) {
  console.log(invoice.preimage);
}

// if you have the preimage for example in a WebLN context
await window.webln.enable();
const response = await window.webln.sendPayment(invoice.paymentRequest);
const paid = invoice.validatePreimage(response.preimage); // returns true or false
if (paid) {
  console.log("paid");
}

// or use the convenient method:
await invoice.isPaid();
```

It is also possible to manually initialize the `Invoice`

```js
import { Invoice } from "@getalby/lightning-tools/bolt11";

const invoice = new Invoice({ pr: pr, preimage: preimage });
await invoice.isPaid();
```

#### Boost a LN address:

You can also attach additional metadata information like app name, version, name of the podcast which is boosted etc. to the keysend payment.

```js
import { LightningAddress } from "@getalby/lightning-tools/lnurl";
const ln = new LightningAddress("hello@getalby.com");
await ln.fetch();

const boost = {
  action: "boost",
  value_msat: 21000,
  value_msat_total: 21000,
  app_name: "Podcastr",
  app_version: "v2.1",
  feedId: "21",
  podcast: "random podcast",
  episode: "1",
  ts: 2121,
  name: "Satoshi",
  sender_name: "Alby",
};
await ln.boost(boost);
```

#### Zapping a LN address on Nostr:

Nostr is a simple, open protocol that enables truly censorship-resistant and global value-for-value publishing on the web. Nostr integrates deeply with Lightning. [more info](https://nostr.how/)

This librarys provides helpers to create [zaps](https://github.com/nostr-protocol/nips/blob/master/57.md).

```js
import { LightningAddress } from "@getalby/lightning-tools/lnurl";
const ln = new LightningAddress("hello@getalby.com");
await ln.fetch();

const response = await ln.zap({
  satoshi: 1000,
  comment: "Awesome post",
  relays: ["wss://relay.damus.io"],
  e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
});
console.log(response.preimage); // print the preimage
```

For a full example see [examples/zaps](examples/zaps.js)

#### Zapping a LN address on Nostr using Nostr Wallet Connect:

Native zaps without a browser extension are possible by using a Nostr Wallet Connect WebLN provider.

See [examples/zaps-nwc](examples/zaps-nwc.js)

> All examples in the [examples/](examples/) directory are runnable. See [examples/README.md](examples/README.md) for setup instructions.

### HTTP 402 - requesting HTTP resources that require a payment

L402, X402, MPP are protocol standards based on the HTTP 402 `Payment Required` code
for machine-to-machine payments. It is used to charge for HTTP API requests, tool calls, or agentic payments.

This library includes functions to consome those resources.

#### fetch402(url: string, fetchArgs, options)

`fetch402` is a single function that transparently handles L402 and X402 and MPP protected resources. Use it when you don't know or don't care which protocol the server uses — it will detect the protocol from the response headers and pay accordingly.

- url: the protected URL
- fetchArgs: arguments are passed to the underlying `fetch()` function used to do the HTTP request
- options:
  - wallet: any object that implements `payInvoice({ invoice })` and returns `{ preimage }`. Used to pay L402, X402 and MPP invoices.

##### Examples

```js
import { fetch402 } from "@getalby/lightning-tools/402";
import { NWCClient } from "@getalby/sdk";

const nwc = new NWCClient({
  nostrWalletConnectUrl: "nostr+walletconnect://...",
});

await fetch402(
  "https://example.com/protected-resource",
  {},
  { wallet: nwc },
)
  .then((res) => res.json())
  .then(console.log)
  .finally(() => nwc.close());
```

#### L402

L402 is a protocol standard based on the HTTP 402 Payment Required error code
designed to support the use case of charging for services and
authenticating users in distributed networks.

This library includes a `fetchWithL402` function to consume L402 protected resources.

##### fetchWithL402(url: string, fetchArgs, options)

- url: the L402 protected URL
- fetchArgs: arguments are passed to the underlying `fetch()` function used to do the HTTP request
- options:
  - wallet: any object (e.g. a NWC client) that implements `payInvoice({ invoice })` and returns `{ preimage }`. Used to pay the L402 invoice.

##### Examples

```js
import { fetchWithL402 } from "@getalby/lightning-tools/402/l402";
import { NWCClient } from "@getalby/sdk";

const nwc = new NWCClient({
  nostrWalletConnectUrl: "nostr+walletconnect://...",
});

await fetchWithL402(
  "https://l402.example.com/protected-resource",
  {},
  { wallet: nwc },
)
  .then((res) => res.json())
  .then(console.log)
  .finally(() => nwc.close());
```

#### X402

Similar to L402 X402 is an open protocol for machine-to-machine payments built on the HTTP 402 Payment Required status code.
It enables APIs and resources to request payments inline, without prior registration or authentication. 

This library includes a `fetchWithX402` function to consume X402-protected resources that support the lightning network. 
(Note: X402 works also with other coins and network. This library supports X402 resources that accept Bitcoin on the lightning network)

##### fetchWithX402(url: string, fetchArgs, options)

- url: the X402 protected URL
- fetchArgs: arguments are passed to the underlying `fetch()` function used to do the HTTP request
- options:
  - wallet: any object (e.g. a NWC client) that implements `payInvoice({ invoice })` and returns `{ preimage }`. Used to pay the X402 invoice.

##### Examples

```js
import { fetchWithX402 } from "@getalby/lightning-tools/402/x402";
import { NWCClient } from "@getalby/sdk";

const nwc = new NWCClient({
  nostrWalletConnectUrl: "nostr+walletconnect://...",
});

await fetchWithX402(
  "https://x402.example.com/protected-resource",
  {},
  { wallet: nwc },
)
  .then((res) => res.json())
  .then(console.log)
  .finally(() => nwc.close());
```

#### MPP

MPP is an open protocol for machine-to-machine payments built on the HTTP 402 Payment Required status code.
Charge for API requests, tool calls, or content—agents and apps pay per request in the same HTTP call.

This library includes a `fetchWithMpp` function to consume MPP-protected resources that support the lightning network. 
(Note: MPP works also with other payment methods. This library supports resources that accept Bitcoin on the lightning network)

##### fetchWithMpp(url: string, fetchArgs, options)

- url: the MPP protected URL
- fetchArgs: arguments are passed to the underlying `fetch()` function used to do the HTTP request
- options:
  - wallet: any object (e.g. a NWC client) that implements `payInvoice({ invoice })` and returns `{ preimage }`. Used to pay the X402 invoice.

##### Examples

```js
import { fetchWithMpp } from "@getalby/lightning-tools/402/mpp";
import { NWCClient } from "@getalby/sdk";

const nwc = new NWCClient({
  nostrWalletConnectUrl: "nostr+walletconnect://...",
});

await fetchWithMpp(
  "https://mpp.example.com/protected-resource",
  {},
  { wallet: nwc },
)
  .then((res) => res.json())
  .then(console.log)
  .finally(() => nwc.close());
```

### Basic invoice decoding

You can initialize an `Invoice` to decode a payment request.

```js
import { Invoice } from "@getalby/lightning-tools/bolt11";

const invoice = new Invoice({ pr });
const { paymentHash, satoshi, description, createdDate, expiryDate } = invoice;
```

> If you need more details about the invoice, use a dedicated BOLT11 decoding library.

### 💵 Fiat conversions

Helpers to convert sats values to fiat and fiat values to sats.

##### getFiatCurrencies(): Promise<FiatCurrency[]>

Returns the list of available fiat currencies sorted by priority

##### getFiatValue(satoshi: number, currency: string): number

Returns the fiat value for a specified currency of a satoshi amount

##### getSatoshiValue(amount: number, currency: string): number

Returns the satoshi value for a specified amount (in the smallest denomination) and currency

##### getFormattedFiatValue(satoshi: number, currency: string, locale: string): string

Like `getFiatValue` but returns a formatted string for a given locale using JavaScript's `toLocaleString`

#### Examples

```js
await fiat.getFiatCurrencies();
await fiat.getFiatValue({ satoshi: 2100, currency: "eur" });
await fiat.getSatoshiValue({ amount: 100, currency: "eur" }); // for 1 EUR
await fiat.getFormattedFiatValue({
  satoshi: 2100,
  currency: "usd",
  locale: "en",
});
```

### 🤖 Lightning Address Proxy

This library uses a [proxy](https://github.com/getAlby/lightning-address-details-proxy) to simplify requests to lightning providers.

- Many ln addresses don't support CORS, which means fetching the data directly in a browser environment will not always work.
- Two requests are required to retrieve lnurlp and keysend data for a lightning address. The proxy will do these for you with a single request.

You can disable the proxy by explicitly setting the proxy to false when initializing a lightning address:

```js
const lightningAddress = new LightningAddress("hello@getalby.com", {
  proxy: false,
});
```

## crypto dependency

If you get an `crypto is not defined` in NodeJS error you have to import it first:

```js
import * as crypto from 'crypto'; // or 'node:crypto'
globalThis.crypto = crypto as any;
//or: global.crypto = require('crypto');
```

## fetch() dependency

This library relies on a global fetch object which will work in browsers and node v18.x or newer. In old version you can manually install a global fetch option or polyfill if needed.

For example:

```js
import fetch from "cross-fetch"; // or "@inrupt/universal-fetch"
globalThis.fetch = fetch;

// or as a polyfill:
import "cross-fetch/polyfill";
```

## 🛠 Development

```
yarn install
yarn run build
```

## Need help?

We are happy to help, please contact us or create an issue.

- [Twitter: @getAlby](https://twitter.com/getAlby)
- [Telegram group](https://t.me/getAlby)
- support at getalby.com
- [bitcoin.design](https://bitcoin.design/) Discord community (find us on the #alby channel)
- Read the [Alby developer guide](https://guides.getalby.com/overall-guide/alby-for-developers/getting-started) to better understand how Alby packages and APIs can be used to power your app.

## License

MIT
