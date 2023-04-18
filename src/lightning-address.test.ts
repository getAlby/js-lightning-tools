import LightningAddress from "./lightning-address";

describe("requestInvoice", () => {
  it("throws error when fetch hasn't been called", async () => {
    const ln = new LightningAddress("hello@getalby.com");
    await expect(ln.requestInvoice({
      satoshi: 1,
    })).rejects.toThrowError("No lnurlpData available. Please fetch first.");
  })
  
  it("generates an invoice ", async () => {
      // TODO: consider mocking responses
      const ln = new LightningAddress("hello@getalby.com");
      await ln.fetch();
      const invoice = await ln.requestInvoice({satoshi: 1});
      expect(invoice.paymentRequest).toContain("lnbc");
  })
});

describe("fetch", () => {
  it("retrieves lnurlp data", async () => {
    // TODO: consider mocking responses
    const ln = new LightningAddress("hello@getalby.com");
    await ln.fetch();
    expect(ln.lnurlpData?.max).toBe(11000000000);
  })
})
