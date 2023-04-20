import LightningAddress, { DEFAULT_PROXY } from "./lightning-address";

const SPEC_TIMEOUT = 10000;

for (const proxy of [DEFAULT_PROXY, false] as const) {
  describe("with proxy: " + proxy, () => {
    describe("requestInvoice", () => {
      it("generates an invoice ", async () => {
          // TODO: consider mocking responses
          const ln = new LightningAddress("hello@getalby.com", {proxy});
          await ln.fetch();
          const invoice = await ln.requestInvoice({satoshi: 1});
          expect(invoice.paymentRequest).toContain("lnbc");
      }, SPEC_TIMEOUT)
    });

    describe("fetch", () => {
      it("retrieves lnurlp data", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.lnurlpData.max).toBe(11000000000);
      }, SPEC_TIMEOUT)
      
      it("retrieves keysend data", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.keysendData.destination).toBe("030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3");
      }, SPEC_TIMEOUT)
    
      it("retrieves nostr data", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.nostrData.names.hello).toEqual("4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e");
      }, SPEC_TIMEOUT)
    
      it("can fetch existing lightning address without nostr configuration", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("test12345678@getalby.com", {proxy});
        await ln.fetch();
        // TODO: change to .toBeFalsy();
        expect(ln.nostrData).toEqual({});
      }, SPEC_TIMEOUT)
      
      it("does not throw error when requesting non-existing lightning address", async () => {
        const ln = new LightningAddress("hellononexistentaddress@getalby.com", {proxy});
        await ln.fetch();
        // TODO: change all below to .toBeFalsy();
        expect(ln.lnurlpData).toEqual({});
        expect(ln.keysendData).toEqual({});
        expect(ln.nostrData).toEqual({});
      }, SPEC_TIMEOUT)
    })
  })
}
