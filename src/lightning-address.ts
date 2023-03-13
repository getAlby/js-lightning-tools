import fetch from 'cross-fetch';
import { isUrl, isValidAmount, parseLnUrlPayResponse } from './utils/lnurl';
import Invoice from './invoice';
import { InvoiceArgs, RequestInvoiceArgs, ZapArgs } from './types';
import { generateZapEvent } from './utils/nostr';

const LN_ADDRESS_REGEX =
  /^((?:[^<>()\[\]\\.,;:\s@"]+(?:\.[^<>()\[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

const DEFAULT_PROXY = "https://lnaddressproxy.getalby.com/lightning-address-details";

type LightningAddressOptions = {
  proxy?: string | false;
}

export default class LightningAddress {
  address: string;
  options: LightningAddressOptions;
  username: string | undefined;
  domain: string | undefined;
  pubkey: string | undefined;
  keysendData: unknown;
  lnurlpData: Record<string, any>;

  constructor(address: string, options?: LightningAddressOptions) {
    this.address = address;
    this.options = { proxy: DEFAULT_PROXY };
    this.options = Object.assign(this.options, options);
    this.parse();
    this.lnurlpData = {};
    this.keysendData = {};
  }

  parse() {
    const result = LN_ADDRESS_REGEX.exec(this.address.toLowerCase());
    if (result) {
      this.username = result[1];
      this.domain = result[2];
    }
  }

  async fetch() {
    if (this.options.proxy) {
      return this.fetchWithProxy();
    } else {
      return this.fetchWithoutProxy();
    }
  }

  async fetchWithProxy() {
    const result = await fetch(`${this.options.proxy}?${new URLSearchParams({ ln: this.address }).toString()}`);
    const json = await result.json();
    this.lnurlpData = json.lnurlp;
    this.keysendData = json.keysend;
  }

  async fetchWithoutProxy() {
    try {
      const lnurlResult = await fetch(this.lnurlpUrl());
      this.lnurlpData = await lnurlResult.json();
    } catch (e) {
    }
    try {
      const keysendResult = await fetch(this.keysendUrl());
      this.keysendData = await keysendResult.json();
    } catch (e) {
    }
  }

  lnurlpUrl() {
    return `https://${this.domain}/.well-known/lnurlp/${this.username}`;
  }

  keysendUrl() {
    return `https://${this.domain}/.well-known/keysend/${this.username}`;
  }

  async generateInvoice(url: URL): Promise<Invoice> {
    const data = await fetch(url);
    const json = await data.json();
    const paymentRequest = json && json.pr && json.pr.toString();
    if (!paymentRequest) throw new Error('Invalid pay service invoice')

    const invoiceArgs: InvoiceArgs = { pr: paymentRequest };
    if (json && json.verify) invoiceArgs.verify = json.verify.toString();

    return new Invoice(invoiceArgs);
  }

  async requestInvoice(args: RequestInvoiceArgs): Promise<Invoice> {
    const msat = args.satoshi * 1000;
    const { callback, commentAllowed, min, max } = parseLnUrlPayResponse(this.lnurlpData);

    if (!isValidAmount({ amount: msat, min, max }))
      throw new Error('Invalid amount')
    if (!isUrl(callback)) throw new Error('Callback must be a valid url')
    if (args.comment && commentAllowed > 0 && args.comment.length > commentAllowed)
      throw new Error(
        `The comment length must be ${commentAllowed} characters or fewer`
      )

    const invoiceParams: { amount: string, comment?: string } = { amount: msat.toString() };
    if (args.comment) invoiceParams.comment = args.comment

    let callbackUrl = new URL(callback)
    callbackUrl.search = new URLSearchParams(invoiceParams).toString()

    return this.generateInvoice(callbackUrl);
  }

  async zap({
    satoshi, comment, relays, p, e
  }: ZapArgs): Promise<Invoice> {
    const msat = satoshi * 1000;
    const { callback, allowsNostr, min, max } = parseLnUrlPayResponse(this.lnurlpData);

    if (!isValidAmount({ amount: msat, min, max }))
      throw new Error('Invalid amount')
    if (!isUrl(callback)) throw new Error('Callback must be a valid url')
    if (!allowsNostr) throw new Error('Your provider does not support zaps')

    const event = await generateZapEvent({
      satoshi: msat, comment, p, e, relays
    })
    const zapParams: { amount: string, nostr: string } = {
      amount: msat.toString(),
      nostr: JSON.stringify(event)
    };

    let callbackUrl = new URL(callback)
    callbackUrl.search = new URLSearchParams(zapParams).toString()

    return this.generateInvoice(callbackUrl);
  }
}
