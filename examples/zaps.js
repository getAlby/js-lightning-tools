import { LightningAddress } from "@getalby/lightning-tools";

(async () => {
  const ln = new LightningAddress("hello@getalby.com");
  await ln.fetch();

  if (!ln.nostrPubkey) {
    alert("No nostr pubkey available"); // seems the lightning address is no NIP05 address
  }

  const zapArgs = {
    satoshi: 1000,
    comment: "Awesome post",
    relays: ["wss://relay.damus.io"],
    e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245", // optional, omit to zap profile directly
  };

  if (window.webln) {
    // zap in one go with WebLN (https://www.webln.guide) (easiest for web apps)
    const response = await ln.zap(zapArgs); // signs zap request event, generates invoice and pays it
    console.log(response.preimage); // print the preimage
  } else {
    // or manually (create an invoice and give it to the user to pay)
    const invoice = await ln.zapInvoice(zapArgs); // generates a zap invoice
    console.log(invoice.paymentRequest); // print the payment request
    await invoice.isPaid(); // check the payment status as descibed above
  }
})();
