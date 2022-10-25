import fetch from 'cross-fetch';

const LN_ADDRESS_REGEX =
/^((?:[^<>()\[\]\\.,;:\s@"]+(?:\.[^<>()\[\]\\.,;:\s@"]+)*)|(?:".+"))@((?:\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(?:(?:[a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export default class LightningAddress {
  address: string;
  options: { proxy: boolean };
  username: string | undefined;
  domain: string | undefined;
  keysendData: unknown;
  lnurlpData: unknown;

  constructor(address: string, options: { proxy: boolean }) {
    this.address = address;
    this.options = { proxy: true, ...options };
    this.parse();
    if (this.options.proxy) {
      this.fetchWithCorsProxy();
    }
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
      return this.fetchWithCorsProxy();
    } else {
      return this.fetchWithoutCorsProxy();
    }
  }

  async fetchWithCorsProxy() {
    const result = await fetch();
  }

  async fetchWithoutCorsProxy() {
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
