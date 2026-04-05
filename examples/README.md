# Examples

Runnable examples for `@getalby/lightning-tools`.

## Setup

```bash
cd examples
yarn
```

> `yarn` links the local package via `file:..` — if you change library source, rebuild first:
>
> ```bash
> cd .. && yarn build && cd examples
> ```

## Running examples

### x402 / L402 — paid API fetch

These examples fetch a URL protected by an HTTP 402 payment wall. You need an [NWC](https://www.nwc.dev) connection string.

```bash
NWC_URL="nostr+walletconnect://..." yarn 402      # auto-detects L402 or x402
NWC_URL="nostr+walletconnect://..." yarn x402     # x402 only
NWC_URL="nostr+walletconnect://..." yarn l402     # L402 only
```

Override the default URL:

```bash
URL="https://your-402-endpoint.example.com" NWC_URL="nostr+walletconnect://..." yarn 402
```

### Lightning Address — request invoice

Fetches LNURL-pay data for a lightning address and requests an invoice. No credentials needed.

```bash
yarn request-invoice
```

### Zaps via NWC

Sends a zap to a lightning address using NWC for payment and a Nostr key for signing.

```bash
NOSTR_PRIVATE_KEY="your-hex-private-key" NWC_URL="nostr+walletconnect://..." yarn zaps-nwc
```
