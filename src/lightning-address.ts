import fetch from 'cross-fetch';
import { isUrl, isValidAmount, parseLnUrlPayResponse } from './utils/lnurl';
import Invoice from './invoice';

const LN_ADDRESS_REGEX =
/^((?:[^<>()\[\]\\.,;:\s@"]+(?:\.[^<>()\[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

const DEFAULT_PROXY = "https://lnaddressproxy.getalby.com/lightning-address-details";

export default class LightningAddress {
  address: string;
  options: { proxy: string };
  username: string | undefined;
  domain: string | undefined;
  keysendData: unknown;
  lnurlpData: Record<string, string | number>;

  constructor(address: string, options: { proxy: string }) {
    this.address = address;
    this.options = { proxy: DEFAULT_PROXY };
    this.options = Object.assign(this.options, options);
    this.parse();
    this.lnurlpData = {};
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
    const result = await fetch(`${this.options.proxy}?${new URLSearchParams({ln: this.address}).toString()}`);
    const json = await result.json();
    this.lnurlpData = json.lnurlp;
    this.keysendData = json.keysend;
  }

  async fetchWithoutProxy() {
    try {
      const lnurlResult = await fetch(this.lnurlpUrl());
      this.lnurlpData = await lnurlResult.json();
    } catch(e) {
    }
    try {
      const keysendResult = await fetch(this.keysendUrl());
      this.keysendData = await keysendResult.json();
    } catch(e) {
    }
  }

  lnurlpUrl() {
    return `https://${this.domain}/.well-known/lnurlp/${this.username}`;
  }

  keysendUrl() {
    return `https://${this.domain}/.well-known/keysend/${this.username}`;
  }

  async requestInvoice(
    amount: number,
    comment: string
  ): Promise<Invoice> {
    await this.fetch();
    const { callback, commentAllowed, min, max } = parseLnUrlPayResponse(this.lnurlpData);
    if (!isValidAmount({ amount: amount / 1000, min, max }))
      throw new Error('Invalid amount')
  
    if (!isUrl(callback)) throw new Error('Callback must be a valid url')

    let callbackUrl = new URL(callback)

    const invoiceParams: {amount: string, comment?: string} = { amount: amount.toString() };

    if (comment && commentAllowed > 0 && comment.length > commentAllowed)
    throw new Error(
      `The comment length must be ${commentAllowed} characters or fewer`
    )
    if (comment) invoiceParams.comment = comment

    callbackUrl.search = new URLSearchParams(invoiceParams).toString()
  
    const data = await fetch(callbackUrl)
    const json = await data.json()
    const paymentRequest = json && json.pr && json.pr.toString()
    const verifyURL = json && (json.verify || '').toString()

    if (!paymentRequest) throw new Error('Invalid pay service invoice')

    const invoice = new Invoice({pr: paymentRequest, verify: verifyURL})

    return invoice;
  }

  requestInvoiceWithProxy(
    lnurl: string,
    sats: number
  ): Promise<{pr: string}> {
    const url = `https://embed.twentyuno.net/invoice?to=${lnurl}&amount=${sats}&comment=`;
    return fetch(url)
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Network response was not OK');
        }
      })
      .then((response) => {
        return {pr: response.payment_request};
      });
  };
}
