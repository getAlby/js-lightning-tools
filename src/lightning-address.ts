import fetch from 'cross-fetch';

const LN_ADDRESS_REGEX =
/^((?:[^<>()\[\]\\.,;:\s@"]+(?:\.[^<>()\[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

const DEFAULT_PROXY = "https://lnaddressproxy.getalby.com/lightning-address-details";

export default class LightningAddress {
  address: string;
  options: { proxy: string };
  username: string | undefined;
  domain: string | undefined;
  keysendData: unknown;
  lnurlpData: unknown;

  constructor(address: string, options: { proxy: string }) {
    this.address = address;
    this.options = { proxy: DEFAULT_PROXY };
    this.options = Object.assign(this.options, options);
    this.parse();
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
