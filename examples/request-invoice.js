import * as crypto from "crypto"; // or 'node:crypto'
global.crypto = crypto;
import { LightningAddress } from "@getalby/lightning-tools";

const ln = new LightningAddress("hello@getalby.com");

await ln.fetch();
// request an invoice for 1000 satoshis
// this returns a new `Invoice` class that can also be used to validate the payment
const invoice = await ln.requestInvoice({ satoshi: 1000 });

console.log(invoice.paymentRequest); // print the payment request
console.log(invoice.paymentHash); // print the payment hash
