import Invoice from "./invoice";
import fetchMock from "jest-fetch-mock";

const paymentRequestWithoutMemo =
  "lnbc10n1pj4xmazpp5ns890al37jpreen4rlpl6fsw2hlp9n9hm0ts4dvwvcxq8atf4v6qhp50kncf9zk35xg4lxewt4974ry6mudygsztsz8qn3ar8pn3mtpe50scqzzsxqyz5vqsp5k508kdmvfpuac6lvn9wumr9x4mcpnh2t6jyp5kkxcjhueq4xjxqq9qyyssq0m88mwgknhkqfsa9u8e9dp8v93xlm0lqggslzj8mpsnx3mdzm8z5k9ns7g299pfm9zwm4crs00a364cmpraxr54jw5cf2qx9vycucggqz2ggul";

const paymentRequestWithoutExpiry =
  "lnbc1u1pjc65cpsp5s0ug8ef4ftz7shgcrg9u32p26yfnss2jvn8lf5ef3dnfs3whj04qpp5u4rd3pf5nuj683ycqs95yxhhxtf0ydt36prvq9ntq54mhqvxax8qdqdg9kxy7fq2ph4xcqzysrzjqtypret4hcklglvtfrdt85l3exc0dctdp4qttmtcy5es3lpt6utsmlnye9rpnzdxcgqqqqqqqqqqqqqqyg9qxpqysgqafjchml7d6zfp7u7mjtcasxzp5pglvpejelazshdfgnzdqw030upmtul2luhqdjvkdcf483u5l5ratu8dk0ffr38ypx9aqk57d7vwfcq3xutqa";

const paymentRequestWithMemo =
  "lnbc10u1pj4t6w0pp54wm83znxp8xly6qzuff2z7u6585rnlcw9uduf2haa42qcz09f5wqdq023jhxapqd4jk6mccqzzsxqyz5vqsp5mlvjs8nktpz98s5dcrhsuelrz94kl2vjukvu789yzkewast6m00q9qyyssqupynqdv7e5y8nlul0trva5t97g7v3gwx7akhu2dvu4pn66eu2pr5zkcnegp8myz3wrpj9ht06pwyfn4dvpmnr96ejq6ygex43ymaffqq3gud4d";

const signetPaymentRequest =
  "lntbs758310n1pnryklfpp59hmrqxpmanfm4sh4afnqs80yas294hvscr2lv0scp4hza7gpyf5sdyzgd5xzmnwv4kzqvpwxqcnqvpsxqcrqgr5dusryvpjxsknqdedxvc9gv338g6nyw35xyhrzd3ntgszscfnxdjrgvryvsukzd3n893njvf5x5mnvctzx9nrsv3hv9jrgvty9ycqzzsxqrrsssp5pq5nl5xw9hf4k7xl8d635kd60kgdm0jnwe3tvu7dp8zrfedcyzes9qyyssq8qcl3h6ptahwtc8k7q9qrz8v3r0fhp779wuhykxkmn0x6qegl4x4jga2ykcwf5vu89slhzka0w4n7a9n26qcxgzhg4mdymky8smdvvqpw9t93a";

const zeroAmountPaymentRequest =
  "lnbc1pn42dukpp5wzqdjf8cv7pxa3rpa5vur8804ud0ckt24jctkq6qlr7w25kuc2fsdp82pshjgr5dusyymrfde4jq4mpd3kx2apq24ek2uscqzpuxqr8pqsp5nkrvgqj37ztv2luy6sfg0fgsr4p4rrqw3s3z5g63f8fsxh86u0hq9p4gqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpqysgqu68rgn4k22zlgzuylamdv6zaczf4rwwrrzlhvw672m8cphctk8shsamruj5ymh04jssy6x09fx99ahrsm7z4w840psu2u3nhtfjw50qpf8qku8";

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
    expect(decodedInvoice.expiryDate!.toISOString()).toBe(
      "2023-11-15T13:01:22.000Z",
    );
    expect(decodedInvoice.description).toBeNull();
    expect(decodedInvoice.hasExpired()).toBe(true);
  });

  test("decode invoice without expiry", () => {
    const decodedInvoice = new Invoice({ pr: paymentRequestWithoutExpiry });
    expect(decodedInvoice.expiryDate).toBeUndefined();
    expect(decodedInvoice.hasExpired()).toBe(false);
  });

  test("decode invoice with description", () => {
    const decodedInvoice = new Invoice({ pr: paymentRequestWithMemo });
    expect(decodedInvoice.description).toBe("Test memo");
  });

  test("decode invoice with zero amount", () => {
    const decodedInvoice = new Invoice({ pr: zeroAmountPaymentRequest });
    expect(decodedInvoice.satoshi).toBe(0);
  });

  test("decode signet invoice", () => {
    const decodedInvoice = new Invoice({ pr: signetPaymentRequest });
    expect(decodedInvoice.satoshi).toBe(75831);
  });

  test("did not expire", () => {
    const decodedInvoice = new Invoice({ pr: paymentRequestWithoutMemo });
    decodedInvoice.expiryDate = new Date(Date.now() + 1000);
    expect(decodedInvoice.hasExpired()).toBe(false);
  });

  test("verify catches exception", async () => {
    const invoice = new Invoice({ pr: paymentRequestWithoutMemo });
    invoice.verify = "https://example.com/verify";

    fetchMock.mockIf(/.*/, (_) => {
      throw new Error("Something went wrong");
    });

    const result = await invoice.verifyPayment();
    expect(result).toBe(false);
  });

  test("verify settled payment", async () => {
    const invoice = new Invoice({ pr: paymentRequestWithoutMemo });
    invoice.verify = "https://example.com/verify";
    const preimage = "dummy preimage";

    fetchMock.mockIf(/.*/, (_) => {
      return Promise.resolve(
        JSON.stringify({
          settled: true,
          preimage,
        }),
      );
    });

    const result = await invoice.verifyPayment();
    expect(result).toBe(true);
    expect(invoice.preimage).toBe(preimage);
  });

  test("verify on unsettled payment", async () => {
    const invoice = new Invoice({ pr: paymentRequestWithoutMemo });
    invoice.verify = "https://example.com/verify";

    fetchMock.mockIf(/.*/, (_) => {
      return Promise.resolve(
        JSON.stringify({
          settled: false,
        }),
      );
    });

    const result = await invoice.verifyPayment();
    expect(result).toBe(false);
    expect(invoice.preimage).toBe(null);
  });

  test("validate preimage", async () => {
    const invoice = new Invoice({
      pr: "lntbs1u1pn495zkdqqnp4qvm5zrv3xj48gy00qxa4njj9kkwc948ul053pxe7v5phulpkkjmvzpp507kr6wlmy9mp0zclumet2w4edxlwpc9sz044v5890569kzycwxjqsp5pusvsaaczett7tmlhulaqa5gnqk74xzxyfmdxrhfjjs82587dm5s9qyysgqcqpcxqyz5vqrzjqv4wssly6lgh0u236qs6eqzykp3ka3etrn3lln09cpr53ke9z74s8apyqqqqqqqpj5qqqqqqqqqqqqqq2qrzjq03slkn33pafzmh42j9y6q4sdlsy42s63h57ysf5eel3888hn46hnapyqqqqqqqq5sqqqqlgqqqq86qqjqrk3pm9hs43rvr7ljfa7vx74s6xxwnzcg6ju8sue69sxlftd9ksuk0k0g0uz3ju9dwmhva2hu4rpl8hezllfy944y5trl5kzk7e4n2pcpjqs23j",
    });

    const validResult = await invoice.validatePreimage(
      "a7b9eab23a1d8442733f78bdfd408349d3dc29f75afb5b037f44ec7ee3835615",
    );
    expect(validResult).toBe(true);

    const invalidResult = await invoice.validatePreimage(
      "b7b9eab23a1d8442733f78bdfd408349d3dc29f75afb5b037f44ec7ee3835615",
    );
    expect(invalidResult).toBe(false);
  });
});
