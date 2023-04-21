import { WebLNProvider } from "@webbtc/webln-types";
import LightningAddress, { DEFAULT_PROXY } from "./lightning-address";
import { Event, NostrProvider } from "./types";
import {UnsignedEvent, finishEvent, generatePrivateKey, getEventHash, getPublicKey, signEvent} from 'nostr-tools'

const dummyWebLN: WebLNProvider = {
  enable: () => Promise.resolve({enabled: false, remember: true}),
  getInfo: () => Promise.resolve({
    methods: [],
    node: {
      alias: "dummy",
      pubkey: "dummy"
    },
    supports: ["lightning"],
    version: "1.0.0",
  }),
  keysend: () => Promise.resolve({
    preimage: "dummy"
  }),
  lnurl: () => Promise.resolve({
    status: "OK",
  }),
  makeInvoice: () => Promise.resolve({
    paymentRequest: "lnbc..."
  }),
  request: () => Promise.resolve({}),
  sendPayment: () => Promise.resolve({
    preimage: "dummy"
  }),
  signMessage: () => Promise.resolve({
    message: "test",
    signature: "TODO"
  }),
  verifyMessage: () => Promise.resolve(),
};

const nostrPrivateKey = generatePrivateKey()
const nostrPublicKey = getPublicKey(nostrPrivateKey)

const nostrProvider: NostrProvider = {
  getPublicKey: () => Promise.resolve(nostrPublicKey),
  signEvent: (event: Event) => {
    return Promise.resolve(finishEvent(event, nostrPrivateKey));
  }
}

const SPEC_TIMEOUT = 10000;

for (const proxy of [DEFAULT_PROXY, false] as const) {
  describe("with proxy: " + proxy, () => {
    describe("requestInvoice", () => {
      it("throws error when fetch hasn't been called", async () => {
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await expect(ln.requestInvoice({
          satoshi: 1,
        })).rejects.toThrowError("No lnurlpData available. Please call fetch() first.");
      })

      it("generates an invoice ", async () => {
          // TODO: consider mocking responses
          const ln = new LightningAddress("hello@getalby.com", {proxy});
          await ln.fetch();
          const invoice = await ln.requestInvoice({satoshi: 1});
          expect(invoice.paymentRequest).toContain("lnbc");
      }, SPEC_TIMEOUT)
    });
    
    describe("boost", () => {
      it("throws error when fetch hasn't been called", async () => {
        const ln = new LightningAddress("hello@getalby.com", {proxy, webln: dummyWebLN});
        await expect(ln.boost({
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
        })).rejects.toThrowError("No keysendData available. Please call fetch() first.");
      })

      it("successful boost returns preimage", async () => {
        const ln = new LightningAddress("hello@getalby.com", {proxy, webln: dummyWebLN});
        await ln.fetch();
        const result = await ln.boost({
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
        });
        expect(result.preimage).toBe("dummy") // from dummyWebLN
      })
    });
    
    describe("zap", () => {
      it("throws error when fetch hasn't been called", async () => {
        const ln = new LightningAddress("hello@getalby.com", {proxy, webln: dummyWebLN});
        await expect(ln.zap({
          satoshi: 1000,
          comment: "Awesome post",
          relays: ["wss://relay.damus.io"],
          e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
        }, {
          nostr: nostrProvider
        })).rejects.toThrowError("No lnurlpData available. Please call fetch() first.");
      })

      it("successful zap returns preimage", async () => {
        const ln = new LightningAddress("hello@getalby.com", {proxy, webln: dummyWebLN});
        await ln.fetch();
        const result = await ln.zap({
          satoshi: 1000,
          comment: "Awesome post",
          relays: ["wss://relay.damus.io"],
          e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
        }, {
          nostr: nostrProvider
        });
        expect(result.preimage).toBe("dummy") // from dummyWebLN
      })
    });

    describe("fetch", () => {
      it("retrieves lnurlp data", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.lnurlpData?.max).toBe(11000000000);
      }, SPEC_TIMEOUT)
      
      it("retrieves keysend data", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.keysendData?.destination).toBe("030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3");
      }, SPEC_TIMEOUT)
    
      it("retrieves nostr data", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("hello@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.nostrData?.names.hello).toEqual("4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e");
      }, SPEC_TIMEOUT)
    
      it("can fetch existing lightning address without nostr configuration", async () => {
        // TODO: consider mocking responses
        const ln = new LightningAddress("test12345678@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.nostrData).toBeUndefined();
      }, SPEC_TIMEOUT)
      
      it("does not throw error when requesting non-existing lightning address", async () => {
        const ln = new LightningAddress("hellononexistentaddress@getalby.com", {proxy});
        await ln.fetch();
        expect(ln.lnurlpData).toBeUndefined();
        expect(ln.keysendData).toBeUndefined();
        expect(ln.nostrData).toBeUndefined();
      }, SPEC_TIMEOUT)
    })
  })
}
