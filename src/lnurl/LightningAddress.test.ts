import { WebLNProvider } from "@webbtc/webln-types";
import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools";
import fetchMock from "jest-fetch-mock";
import { LightningAddress, DEFAULT_PROXY } from "./LightningAddress";
import { Event, NostrProvider } from "./types";
import { isValidAmount, isUrl, parseLnUrlPayResponse } from "./utils";

const dummyWebLN: WebLNProvider = {
  enable: () => Promise.resolve(),
  getInfo: () =>
    Promise.resolve({
      methods: [],
      node: {
        alias: "dummy",
        pubkey: "dummy",
      },
      supports: ["lightning"],
      version: "1.0.0",
    }),
  keysend: () =>
    Promise.resolve({
      preimage: "dummy",
    }),
  lnurl: () =>
    Promise.resolve({
      status: "OK",
    }),
  makeInvoice: () =>
    Promise.resolve({
      paymentRequest: "lnbc...",
    }),
  request: () => Promise.resolve({}),
  sendPayment: () =>
    Promise.resolve({
      preimage: "dummy",
    }),
  signMessage: () =>
    Promise.resolve({
      message: "test",
      signature: "TODO",
    }),
  verifyMessage: () => Promise.resolve(),
};

const nostrPrivateKey = generateSecretKey();
const nostrPublicKey = getPublicKey(nostrPrivateKey);

const nostrProvider: NostrProvider = {
  getPublicKey: () => Promise.resolve(nostrPublicKey),
  signEvent: (event: Event) => {
    return Promise.resolve(finalizeEvent(event, nostrPrivateKey));
  },
};

// TODO: refactor tests to set their own mocks rather than using conditionals and loops
fetchMock.mockIf(/.*/, (req) => {
  if (
    req.url.startsWith(
      "https://api.getalby.com/lnurl/generate-invoice?ln=hello%40getalby.com&amount=1000",
    )
  ) {
    return Promise.resolve(
      JSON.stringify({
        invoice: {
          pr: "lnbc10u1pjk6mhgpp5zj5mn43uz96y94vevla98990gtkm0fa5jysvfl2wx6q2lllkyd9shp56x0knvgt833500x88k786uqc7nqpa563vgzt5e9c7srg4h8vqf2qcqzzsxqyz5vqsp5h8crvhl0etrgc3jfwwqypmckvp5szw8a8mhnzw0xk6ru5anyak6q9qyyssq0dcsf56fhdwjd4adwlljetpkhdanckgxgwx49fu49h9hxjj0haq9tg867x6acudjraxvwuuq033004jy8fwx98hd69c9z3az2qhv3wsq6wwe8p",
          routes: [],
          status: "OK",
          successAction: {
            message: "Thanks, sats received!",
            tag: "message",
          },
          verify:
            "https://getalby.com/lnurlp/hello/verify/bAJyn6sqHgWhStciroY4yy8t",
        },
      }),
    );
  } else if (
    req.url.startsWith("https://getalby.com/lnurlp/hello/callback?amount=1000")
  ) {
    return Promise.resolve(
      JSON.stringify({
        pr: "lnbc10n1pjk6m6spp57n44qespk3z2hjfc6wxmyqjy8aprdz5k6jflu9q5gw6wqm3y0ssqhp50kncf9zk35xg4lxewt4974ry6mudygsztsz8qn3ar8pn3mtpe50scqzzsxqyz5vqsp5creygvh0cmhjnqsvq7c9k5w9fpe4yy0sw025msv7ut09krp9g5ds9qyyssqlpl0539nx0rhmtltzzaeznnt967msvnuqe7k9mhld8xvs032ysy5697hsene3xat2ujxahfe63c6ces82jd2hcv2dmuynkf2p7cttuqpm6qdfm",
        routes: [],
        status: "OK",
        successAction: {
          message: "Thanks, sats received!",
          tag: "message",
        },
        verify:
          "https://getalby.com/lnurlp/hello/verify/7wMPUUqFfaUaM6sG6GwFFSTq",
      }),
    );
  } else if (req.url.endsWith("ln=hello%40getalby.com")) {
    return Promise.resolve(
      JSON.stringify({
        lnurlp: {
          allowsNostr: true,
          callback: "https://getalby.com/lnurlp/hello/callback",
          commentAllowed: 255,
          maxSendable: 11000000000,
          metadata:
            '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
          minSendable: 1000,
          nostrPubkey:
            "79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432",
          payerData: {
            email: {
              mandatory: false,
            },
            name: {
              mandatory: false,
            },
            pubkey: {
              mandatory: false,
            },
          },
          status: "OK",
          tag: "payRequest",
        },
        keysend: {
          customData: [
            {
              customKey: "696969",
              customValue: "017rsl75kNnSke4mMHYE",
            },
          ],
          pubkey:
            "030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3",
          status: "OK",
          tag: "keysend",
        },
        nostr: {
          names: {
            hello:
              "4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e",
          },
        },
      }),
    );
  } else if (req.url.indexOf("ln=wintertree4%40getalby.com") > -1) {
    return Promise.resolve(
      JSON.stringify({
        lnurlp: {
          allowsNostr: true,
          callback: "https://getalby.com/lnurlp/hello/callback",
          commentAllowed: 255,
          maxSendable: 11000000000,
          metadata:
            '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
          minSendable: 1000,
          nostrPubkey:
            "79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432",
          payerData: {
            email: {
              mandatory: false,
            },
            name: {
              mandatory: false,
            },
            pubkey: {
              mandatory: false,
            },
          },
          status: "OK",
          tag: "payRequest",
        },
        keysend: {
          customData: [
            {
              customKey: "696969",
              customValue: "017rsl75kNnSke4mMHYE",
            },
          ],
          pubkey:
            "030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3",
          status: "OK",
          tag: "keysend",
        },
        nostr: null,
      }),
    );
  } else if (req.url.indexOf("ln=hrf%40btcpay.hrf.org") > -1) {
    return Promise.resolve(
      JSON.stringify({
        lnurlp: {
          callback:
            "https://btcpay.hrf.org/BTC/UILNURL/pay/i/CTx9XVtkW5QuYvMXhDPsfP",
          commentAllowed: 0,
          maxSendable: 612000000000,
          metadata:
            '[["text/plain","Paid to Donate to HRF v2  (Order ID: )"],["text/identifier","hrf@btcpay.hrf.org"]]',
          minSendable: 1000,
          tag: "payRequest",
        },
        keysend: null,
        nostr: null,
      }),
    );
  } else if (req.url.indexOf("ln=hellononexistentaddress%40getalby.com") > -1) {
    return Promise.resolve(
      JSON.stringify({
        lnurlp: null,
        keysend: null,
        nostr: null,
      }),
    );
  } else if (
    req.url.endsWith("lnurlp/hello") ||
    req.url.endsWith("lnurlp/wintertree4")
  ) {
    return Promise.resolve(
      JSON.stringify({
        allowsNostr: true,
        callback: "https://getalby.com/lnurlp/hello/callback",
        commentAllowed: 255,
        maxSendable: 11000000000,
        metadata:
          '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
        minSendable: 1000,
        nostrPubkey:
          "79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432",
        payerData: {
          email: {
            mandatory: false,
          },
          name: {
            mandatory: false,
          },
          pubkey: {
            mandatory: false,
          },
        },
        status: "OK",
        tag: "payRequest",
      }),
    );
  } else if (req.url === "https://btcpay.hrf.org/.well-known/lnurlp/hrf") {
    return Promise.resolve(
      JSON.stringify({
        callback:
          "https://btcpay.hrf.org/BTC/UILNURL/pay/i/8NTBF2qoCHBNSF49hqot4j",
        metadata:
          '[["text/plain","Paid to Donate to HRF v2  (Order ID: )"],["text/identifier","hrf@btcpay.hrf.org"]]',
        tag: "payRequest",
        minSendable: 1000,
        maxSendable: 612000000000,
        commentAllowed: 0,
      }),
    );
  } else if (req.url.endsWith("/hellononexistentaddress")) {
    return Promise.resolve({
      status: 404,
    });
  } else if (
    req.url.endsWith("keysend/hello") ||
    req.url.endsWith("keysend/hrf") ||
    req.url.endsWith("keysend/wintertree4")
  ) {
    return Promise.resolve(
      JSON.stringify({
        customData: [
          {
            customKey: "696969",
            customValue: "017rsl75kNnSke4mMHYE",
          },
        ],
        pubkey:
          "030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3",
        status: "OK",
        tag: "keysend",
      }),
    );
  } else if (req.url.endsWith("nostr.json?name=hello")) {
    return Promise.resolve(
      JSON.stringify({
        names: {
          hello:
            "4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e",
        },
      }),
    );
  } else if (
    req.url.endsWith("nostr.json?name=hellononexistentaddress") ||
    req.url.endsWith("nostr.json?name=wintertree4") ||
    req.url.endsWith("nostr.json?name=hrf")
  ) {
    return Promise.resolve({
      status: 404,
    });
  }
  throw new Error("Unmocked request: " + req.url);
});

for (const proxy of [DEFAULT_PROXY, false] as const) {
  describe("with proxy: " + proxy, () => {
    describe("requestInvoice", () => {
      it("throws error when fetch hasn't been called", async () => {
        const ln = new LightningAddress("hello@getalby.com", { proxy });
        await expect(
          ln.requestInvoice({
            satoshi: 1,
          }),
        ).rejects.toThrowError(
          "No lnurlpData available. Please call fetch() first.",
        );
      });

      it("generates an invoice", async () => {
        const ln = new LightningAddress("hello@getalby.com", { proxy });
        await ln.fetch();
        const invoice = await ln.requestInvoice({ satoshi: 1 });
        expect(invoice.paymentRequest).toContain("lnbc");
        expect(invoice.successAction?.tag).toContain("message");
      });
    });

    describe("boost", () => {
      it("throws error when fetch hasn't been called", async () => {
        const ln = new LightningAddress("hello@getalby.com", {
          proxy,
          webln: dummyWebLN,
        });
        await expect(
          ln.boost({
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
          }),
        ).rejects.toThrowError(
          "No keysendData available. Please call fetch() first.",
        );
      });

      it("successful boost returns preimage", async () => {
        const ln = new LightningAddress("hello@getalby.com", {
          proxy,
          webln: dummyWebLN,
        });
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
        expect(result.preimage).toBe("dummy"); // from dummyWebLN
      });
    });

    describe("zap", () => {
      it("throws error when fetch hasn't been called", async () => {
        const ln = new LightningAddress("hello@getalby.com", {
          proxy,
          webln: dummyWebLN,
        });
        await expect(
          ln.zap(
            {
              satoshi: 1000,
              comment: "Awesome post",
              relays: ["wss://relay.damus.io"],
              e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
            },
            {
              nostr: nostrProvider,
            },
          ),
        ).rejects.toThrowError(
          "No lnurlpData available. Please call fetch() first.",
        );
      });

      it("successful zap returns preimage", async () => {
        const ln = new LightningAddress("hello@getalby.com", {
          proxy,
          webln: dummyWebLN,
        });
        await ln.fetch();
        const result = await ln.zap(
          {
            satoshi: 1000,
            comment: "Awesome post",
            relays: ["wss://relay.damus.io"],
            e: "44e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245",
          },
          {
            nostr: nostrProvider,
          },
        );
        expect(result.preimage).toBe("dummy"); // from dummyWebLN
      });
    });

    describe("fetch", () => {
      it("retrieves lnurlp data for lightning address without keysend or nostr", async () => {
        const ln = new LightningAddress("hrf@btcpay.hrf.org", { proxy });
        await ln.fetch();
        expect(ln.lnurlpData?.max).toBe(612000000000);
      });

      it("retrieves lnurlp data", async () => {
        const ln = new LightningAddress("hello@getalby.com", { proxy });
        await ln.fetch();
        expect(ln.lnurlpData?.max).toBe(11000000000);
      });

      it("retrieves keysend data", async () => {
        const ln = new LightningAddress("hello@getalby.com", { proxy });
        await ln.fetch();
        expect(ln.keysendData?.destination).toBe(
          "030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3",
        );
      });

      it("retrieves nostr data", async () => {
        const ln = new LightningAddress("hello@getalby.com", { proxy });
        await ln.fetch();
        expect(ln.nostrData?.names.hello).toEqual(
          "4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e",
        );
      });

      it("can fetch existing lightning address without nostr configuration", async () => {
        const ln = new LightningAddress("wintertree4@getalby.com", { proxy });
        await ln.fetch();
        expect(ln.nostrData).toBeUndefined();
      });

      it("does not throw error when requesting non-existing lightning address", async () => {
        const ln = new LightningAddress("hellononexistentaddress@getalby.com", {
          proxy,
        });
        await ln.fetch();
        expect(ln.lnurlpData).toBeUndefined();
        expect(ln.keysendData).toBeUndefined();
        expect(ln.nostrData).toBeUndefined();
      });
    });
  });
}

describe("isValidAmount", () => {
  test("amount must be in range", () => {
    expect(isValidAmount({ amount: 0, min: 1, max: 2 })).toBe(false);
    expect(isValidAmount({ amount: 3, min: 1, max: 2 })).toBe(false);
    expect(isValidAmount({ amount: 0, min: 1, max: 1 })).toBe(false);
    expect(isValidAmount({ amount: 2, min: 1, max: 1 })).toBe(false);
    expect(isValidAmount({ amount: 1, min: 1, max: 2 })).toBe(true);
    expect(isValidAmount({ amount: 2, min: 1, max: 2 })).toBe(true);
    expect(isValidAmount({ amount: 1, min: 1, max: 1 })).toBe(true);
    expect(isValidAmount({ amount: 1, min: 0, max: 2 })).toBe(true);
  });
});

describe("isUrl", () => {
  test("url must be a valid http URL", () => {
    expect(
      isUrl(
        "lnurl1dp68gurn8ghj7em9w3skccne9e3k7mf0d3h82unvwqhksetvd3hj7cmpd3kxyctrdvlkzmt0w4h8g0f3xqcrqvpssx932j",
      ),
    ).toBe(false);
    expect(
      isUrl("https://getalby.com/lnurlp/hello/callback?amount=100000"),
    ).toBe(true);
  });
});

describe("parseLnUrlPayResponse", () => {
  test("min/max must be in millisats", async () => {
    const response = {
      status: "OK",
      tag: "payRequest",
      commentAllowed: 255,
      callback: "https://getalby.com/lnurlp/hello/callback",
      metadata:
        '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
      minSendable: 1000,
      maxSendable: 11000000000,
      payerData: { name: { mandatory: false }, email: { mandatory: false } },
      nostrPubkey:
        "79f00d3f5a19ec806189fcab03c1be4ff81d18ee4f653c88fac41fe03570f432",
      allowsNostr: true,
    };
    const parsed = await parseLnUrlPayResponse(response);
    expect(parsed.min).toBe(1000);
    expect(parsed.max).toBe(11000000000);
  });
  test("fixed amount", async () => {
    const response = {
      status: "OK",
      tag: "payRequest",
      callback: "https://getalby.com/lnurlp/hello/callback",
      metadata:
        '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
      minSendable: 1000,
      maxSendable: 1000,
    };
    const parsed = await parseLnUrlPayResponse(response);
    expect(parsed.fixed).toBe(true);
  });
  test("exception on invalid callback URL", async () => {
    const response = {
      status: "OK",
      tag: "payRequest",
      callback: "//getalby.com/lnurlp/hello/callback",
      metadata:
        '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
      minSendable: 1000,
      maxSendable: 11000000000,
    };
    expect(parseLnUrlPayResponse(response)).rejects.toThrow(
      "Callback must be a valid url",
    );
  });
  test("identifier must be set", async () => {
    const response = {
      status: "OK",
      tag: "payRequest",
      callback: "https://getalby.com/lnurlp/hello/callback",
      metadata:
        '[["text/identifier","hello@getalby.com"],["text/plain","Sats for Alby"]]',
      minSendable: 1000,
      maxSendable: 11000000000,
    };
    const parsed = await parseLnUrlPayResponse(response);
    expect(parsed.identifier).toBe("hello@getalby.com");
    expect(parsed.email).toBe("");
  });
  test("email must be set", async () => {
    const response = {
      status: "OK",
      tag: "payRequest",
      callback: "https://getalby.com/lnurlp/hello/callback",
      metadata:
        '[["text/email","hello@getalby.com"],["text/plain","Sats for Alby"]]',
      minSendable: 1000,
      maxSendable: 11000000000,
    };
    const parsed = await parseLnUrlPayResponse(response);
    expect(parsed.identifier).toBe("");
    expect(parsed.email).toBe("hello@getalby.com");
  });
  // TODO: add more tests
});
