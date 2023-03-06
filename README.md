<p align="center">
  <img width="100%" src="docs/Header.png">
</p>

An npm package that provides useful tools to build on the lightning network.

## 🚀 Quick Start

```
npm install alby-tools
yarn add alby-tools
```

## 🤙 Usage

Generating an Invoice:

```js
const { LightningAddress } = require("alby-tools");

const ln = new LightningAddress("satoshi@getalby.com");

await ln.fetch();
const invoice = await ln.requestInvoice(1000); // request an invoice for 1000 satoshis
console.log(invoice.paymentRequest); // print the payment request
```

Zapping an event on nostr:

```js
const ln = new LightningAddress("satoshi@getalby.com");

const zapArgs = {
  amount: 1000,
  comment: "Awesome post",
  relays: ["wss://relay.damus.io"],
  p: "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
  e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
}

await ln.fetch();
const invoice = await ln.zap(zapArgs); // generates a zap invoice
console.log(invoice.paymentRequest); // print the payment request
```

To check if an invoice has been paid:

```js
const invoice = await ln.requestInvoice(1000);

// wait for payment

if (await invoice.isPaid()) {
  // payment successful
} else {
  // retry
}
```

## 🛠 Development

```
yarn install
yarn run build
```