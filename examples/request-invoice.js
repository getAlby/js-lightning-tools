import { LightningAddress } from "@getalby/lightning-tools";

const ln = new LightningAddress("hello@getalby.com");

await ln.fetch();
// request an invoice for 1000 satoshis
// this returns a new `Invoice` class that can also be used to validate the payment
const invoice = await ln.requestInvoice({ satoshi: 1000 });

console.info(invoice.paymentRequest); // print the payment request
console.info(invoice.paymentHash); // print the payment hash
