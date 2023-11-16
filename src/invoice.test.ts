import Invoice from "./invoice";

const paymentRequestWithoutMemo =
  "lnbc10n1pj4xmazpp5ns890al37jpreen4rlpl6fsw2hlp9n9hm0ts4dvwvcxq8atf4v6qhp50kncf9zk35xg4lxewt4974ry6mudygsztsz8qn3ar8pn3mtpe50scqzzsxqyz5vqsp5k508kdmvfpuac6lvn9wumr9x4mcpnh2t6jyp5kkxcjhueq4xjxqq9qyyssq0m88mwgknhkqfsa9u8e9dp8v93xlm0lqggslzj8mpsnx3mdzm8z5k9ns7g299pfm9zwm4crs00a364cmpraxr54jw5cf2qx9vycucggqz2ggul";

const paymentRequestWithMemo =
  "lnbc10u1pj4t6w0pp54wm83znxp8xly6qzuff2z7u6585rnlcw9uduf2haa42qcz09f5wqdq023jhxapqd4jk6mccqzzsxqyz5vqsp5mlvjs8nktpz98s5dcrhsuelrz94kl2vjukvu789yzkewast6m00q9qyyssqupynqdv7e5y8nlul0trva5t97g7v3gwx7akhu2dvu4pn66eu2pr5zkcnegp8myz3wrpj9ht06pwyfn4dvpmnr96ejq6ygex43ymaffqq3gud4d";

describe("Invoice", () => {
  test("decode invoice without description", () => {
    const decodedInvoice = new Invoice({ pr: paymentRequestWithoutMemo });
    expect(decodedInvoice.paymentHash).toBe(
      "9c0e57f7f1f4823ce6751fc3fd260e55fe12ccb7dbd70ab58e660c03f569ab34",
    );
    expect(decodedInvoice.satoshi).toBe(1);
    expect(decodedInvoice.expiry).toBe(86400);
    expect(decodedInvoice.timestamp).toBe(1699966882);
    expect(decodedInvoice.createdDate.toISOString()).toBe(
      "2023-11-14T13:01:22.000Z",
    );
    expect(decodedInvoice.expiryDate.toISOString()).toBe(
      "2023-11-15T13:01:22.000Z",
    );
    expect(decodedInvoice.description).toBeNull();
  });
  test("decode invoice with description", () => {
    const decodedInvoice = new Invoice({ pr: paymentRequestWithMemo });
    expect(decodedInvoice.description).toBe("Test memo");
  });
});
