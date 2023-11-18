import { Data as KeySendRawData, parseKeysendResponse } from "./utils/keysend";
import { isUrl, isValidAmount, parseLnUrlPayResponse } from "./utils/lnurl";
import Invoice from "./invoice";
import {
  InvoiceArgs,
  LnUrlPayResponse,
  LnUrlRawData,
  NostrResponse,
  RequestInvoiceArgs,
  ZapArgs,
  ZapOptions,
} from "./types";
import { generateZapEvent, parseNostrResponse } from "./utils/nostr";
import type { Boost } from "./podcasting2/boostagrams";
import { boost as booster } from "./podcasting2/boostagrams";
import { WebLNProvider, SendPaymentResponse } from "@webbtc/webln-types";
import { KeysendResponse } from "./types";

const LN_ADDRESS_REGEX =
  /^((?:[^<>()[\]\\.,;:\s@"]+(?:\.[^<>()[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const DEFAULT_PROXY = "https://api.getalby.com/lnurl";

type LightningAddressOptions = {
  proxy?: string | false;
  webln?: WebLNProvider;
};

export default class LightningAddress {
  address: string;
  options: LightningAddressOptions;
  username: string | undefined;
  domain: string | undefined;
  pubkey: string | undefined;
  lnurlpData: LnUrlPayResponse | undefined;
  keysendData: KeysendResponse | undefined;
  nostrData: NostrResponse | undefined;
  nostrPubkey: string | undefined;
  nostrRelays: string[] | undefined;
  webln: WebLNProvider | undefined;

  constructor(address: string, options?: LightningAddressOptions) {
    this.address = address;
    this.options = { proxy: DEFAULT_PROXY };
    this.options = Object.assign(this.options, options);
    this.parse();
    this.webln = this.options.webln;
  }

  parse() {
    const result = LN_ADDRESS_REGEX.exec(this.address.toLowerCase());
    if (result) {
      this.username = result[1];
      this.domain = result[2];
    }
  }

  getWebLN() {
    return this.webln || globalThis.webln
  }

  async fetch() {
    if (this.options.proxy) {
      return this.fetchWithProxy();
    } else {
      return this.fetchWithoutProxy();
    }
  }

  async fetchWithProxy() {
    const result = await fetch(
      `${this.options.proxy}/lightning-address-details?${new URLSearchParams({
        ln: this.address,
      }).toString()}`,
    );
    const json = await result.json();

    this.parseResponse(json.lnurlp, json.keysend, json.nostr);
  }

  async fetchWithoutProxy() {
    if (!this.domain || !this.username) {
      return;
    }
    const lnurlResult = await fetch(this.lnurlpUrl());
    const keysendResult = await fetch(this.keysendUrl());
    const nostrResult = await fetch(this.nostrUrl());

    let lnurlData: LnUrlRawData | undefined;
    if (lnurlResult.ok) {
      lnurlData = await lnurlResult.json();
    }
    let keysendData: KeySendRawData | undefined;
    if (keysendResult.ok) {
      keysendData = await keysendResult.json();
    }
    let nostrData: NostrResponse | undefined;
    if (nostrResult.ok) {
      nostrData = await nostrResult.json();
    }

    this.parseResponse(lnurlData, keysendData, nostrData);
  }

  lnurlpUrl() {
    return `https://${this.domain}/.well-known/lnurlp/${this.username}`;
  }

  keysendUrl() {
    return `https://${this.domain}/.well-known/keysend/${this.username}`;
  }

  nostrUrl() {
    return `https://${this.domain}/.well-known/nostr.json?name=${this.username}`;
  }

  async generateInvoice(params: Record<string, string>): Promise<Invoice> {
    let data;
    if (this.options.proxy) {
      const invoiceResult = await fetch(
        `${this.options.proxy}/generate-invoice?${new URLSearchParams({
          ln: this.address,
          ...params,
        }).toString()}`,
      );
      const json = await invoiceResult.json();
      data = json.invoice;
    } else {
      if (!this.lnurlpData) {
        throw new Error("No lnurlpData available. Please call fetch() first.");
      }
      if (!this.lnurlpData.callback || !isUrl(this.lnurlpData.callback))
        throw new Error("Valid callback does not exist in lnurlpData");
      const callbackUrl = new URL(this.lnurlpData.callback);
      callbackUrl.search = new URLSearchParams(params).toString();
      const invoiceResult = await fetch(callbackUrl);
      data = await invoiceResult.json();
    }

    const paymentRequest = data && data.pr && data.pr.toString();
    if (!paymentRequest) throw new Error("Invalid pay service invoice");

    const invoiceArgs: InvoiceArgs = { pr: paymentRequest };
    if (data && data.verify) invoiceArgs.verify = data.verify.toString();

    return new Invoice(invoiceArgs);
  }

  async requestInvoice(args: RequestInvoiceArgs): Promise<Invoice> {
    if (!this.lnurlpData) {
      throw new Error("No lnurlpData available. Please call fetch() first.");
    }
    const msat = args.satoshi * 1000;
    const { commentAllowed, min, max } = this.lnurlpData;

    if (!isValidAmount({ amount: msat, min, max }))
      throw new Error("Invalid amount");
    if (
      args.comment &&
      commentAllowed &&
      commentAllowed > 0 &&
      args.comment.length > commentAllowed
    )
      throw new Error(
        `The comment length must be ${commentAllowed} characters or fewer`,
      );

    const invoiceParams: {
      amount: string;
      comment?: string;
      payerdata?: string;
    } = { amount: msat.toString() };
    if (args.comment) invoiceParams.comment = args.comment;
    if (args.payerdata)
      invoiceParams.payerdata = JSON.stringify(args.payerdata);

    return this.generateInvoice(invoiceParams);
  }

  async boost(boost: Boost, amount: number = 0) {
    if (!this.keysendData) {
      throw new Error("No keysendData available. Please call fetch() first.");
    }
    const { destination, customKey, customValue } = this.keysendData;
    const webln = this.getWebLN()
    if (!webln) {
      throw new Error("WebLN not available");
    }
    return booster(
      {
        destination,
        customKey,
        customValue,
        amount,
        boost,
      },
      { webln },
    );
  }

  async zapInvoice(
    { satoshi, comment, relays, e }: ZapArgs,
    options: ZapOptions = {},
  ): Promise<Invoice> {
    if (!this.lnurlpData) {
      throw new Error("No lnurlpData available. Please call fetch() first.");
    }
    if (!this.nostrPubkey) {
      throw new Error("Nostr Pubkey is missing");
    }
    const p = this.nostrPubkey;
    const msat = satoshi * 1000;
    const { allowsNostr, min, max } = this.lnurlpData;

    if (!isValidAmount({ amount: msat, min, max }))
      throw new Error("Invalid amount");
    if (!allowsNostr) throw new Error("Your provider does not support zaps");

    const event = await generateZapEvent(
      {
        satoshi: msat,
        comment,
        p,
        e,
        relays,
      },
      options,
    );
    const zapParams: { amount: string; nostr: string } = {
      amount: msat.toString(),
      nostr: JSON.stringify(event),
    };

    const invoice = await this.generateInvoice(zapParams);
    return invoice;
  }

  async zap(
    args: ZapArgs,
    options: ZapOptions = {},
  ): Promise<SendPaymentResponse> {
    const invoice = this.zapInvoice(args, options);
    const webln = this.getWebLN()
    if (!webln) {
      throw new Error("WebLN not available");
    }
    await webln.enable();
    const response = webln.sendPayment((await invoice).paymentRequest);
    return response;
  }

  private parseResponse(
    lnurlpData: LnUrlRawData | undefined,
    keysendData: KeySendRawData | undefined,
    nostrData: NostrResponse | undefined,
  ) {
    if (lnurlpData) {
      this.lnurlpData = parseLnUrlPayResponse(lnurlpData);
    }
    if (keysendData) {
      this.keysendData = parseKeysendResponse(keysendData);
    }
    if (nostrData) {
      [this.nostrData, this.nostrPubkey, this.nostrRelays] = parseNostrResponse(
        nostrData,
        this.username,
      );
    }
  }
}
