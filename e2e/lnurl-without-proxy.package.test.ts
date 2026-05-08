import { readFileSync } from 'fs'
import { join } from 'path'
import fetchMock from 'jest-fetch-mock'
import type { Event } from '../src/lnurl/types'
import { LightningAddress } from '@getalby/lightning-tools/lnurl'

const fixtureDir = join(process.cwd(), 'e2e', 'fixtures')
const fixture = (name: string) => readFileSync(join(fixtureDir, name), 'utf-8')

function requestUrl(input: string | Request | URL | undefined): string {
  if (input == null) return ''
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

describe('e2e: LightningAddress without proxy (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('generateInvoice hits callback with top-level pr', async () => {
    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes('/.well-known/lnurlp/')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-pay-request.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('/.well-known/keysend/') || url.includes('nostr.json')) {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      if (url.includes('/lnurlp/hello/callback')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-callback-invoice.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      return Promise.resolve(new Response('unexpected url', { status: 500 }))
    })

    const ln = new LightningAddress('hello@getalby.com', { proxy: false })
    await ln.fetch()
    const invoice = await ln.generateInvoice({ amount: '1000' })

    expect(invoice.paymentRequest).toContain('lnbc')
    expect(invoice.successAction?.tag).toBe('message')
  })

  test('zapInvoice uses nostr signer and callback', async () => {
    const nostrPk =
      '4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e'
    const mockNostr = {
      getPublicKey: jest.fn().mockResolvedValue(nostrPk),
      signEvent: jest.fn().mockImplementation(async (ev: Event) => ({
        ...ev,
        sig: '0'.repeat(128)
      }))
    }

    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes('/.well-known/lnurlp/')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-pay-request.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('/.well-known/keysend/')) {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      if (url.includes('nostr.json')) {
        return Promise.resolve(
          new Response(fixture('nostr-well-known.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('/lnurlp/hello/callback')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-callback-invoice.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      return Promise.resolve(new Response('unexpected url', { status: 500 }))
    })

    const ln = new LightningAddress('hello@getalby.com', { proxy: false })
    await ln.fetch()

    const invoice = await ln.zapInvoice(
      { satoshi: 1, relays: ['wss://relay.example.com'] },
      { nostr: mockNostr }
    )

    expect(mockNostr.getPublicKey).toHaveBeenCalled()
    expect(mockNostr.signEvent).toHaveBeenCalled()
    expect(invoice.paymentRequest).toContain('lnbc')
  })

  test('boost sends keysend via WebLN', async () => {
    const webln = {
      enable: jest.fn().mockResolvedValue(undefined),
      keysend: jest.fn().mockResolvedValue({ preimage: '00'.repeat(32) })
    }

    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes('/.well-known/lnurlp/')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-pay-request.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('/.well-known/keysend/')) {
        return Promise.resolve(
          new Response(fixture('keysend-well-known.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('nostr.json')) {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      return Promise.resolve(new Response('unexpected url', { status: 500 }))
    })

    const boost = {
      action: 'boost',
      value_msat: 21000,
      value_msat_total: 21000,
      app_name: 'e2e',
      app_version: '1.0.0',
      feedId: 'feed',
      podcast: 'Pod',
      episode: 'Ep1',
      ts: 1,
      name: 'listener',
      sender_name: 'anon'
    }

    const ln = new LightningAddress('hello@getalby.com', {
      proxy: false,
      webln: webln as never
    })
    await ln.fetch()
    await ln.boost(boost, 21)

    expect(webln.enable).toHaveBeenCalled()
    expect(webln.keysend).toHaveBeenCalled()
    const params = webln.keysend.mock.calls[0][0]
    expect(params.destination).toBe(
      '030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3'
    )
    expect(params.amount).toBe(21)
    expect(params.customRecords['7629169']).toContain('value_msat')
  })

  test('zap pays invoice via WebLN sendPayment', async () => {
    const nostrPk =
      '4657dfe8965be8980a93072bcfb5e59a65124406db0f819215ee78ba47934b3e'
    const mockNostr = {
      getPublicKey: jest.fn().mockResolvedValue(nostrPk),
      signEvent: jest.fn().mockImplementation(async (ev: Event) => ({
        ...ev,
        sig: '0'.repeat(128)
      }))
    }
    const sendPayment = jest
      .fn()
      .mockResolvedValue({ preimage: 'ab'.repeat(32) })
    const webln = {
      enable: jest.fn().mockResolvedValue(undefined),
      sendPayment
    }

    fetchMock.mockImplementation((input) => {
      const url = requestUrl(input)
      if (url.includes('/.well-known/lnurlp/')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-pay-request.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('/.well-known/keysend/')) {
        return Promise.resolve(new Response(null, { status: 404 }))
      }
      if (url.includes('nostr.json')) {
        return Promise.resolve(
          new Response(fixture('nostr-well-known.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      if (url.includes('/lnurlp/hello/callback')) {
        return Promise.resolve(
          new Response(fixture('lnurlp-callback-invoice.json'), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }
      return Promise.resolve(new Response('unexpected url', { status: 500 }))
    })

    const ln = new LightningAddress('hello@getalby.com', {
      proxy: false,
      webln: webln as never
    })
    await ln.fetch()

    await ln.zap(
      { satoshi: 1, relays: ['wss://relay.example.com'] },
      { nostr: mockNostr }
    )

    expect(webln.enable).toHaveBeenCalled()
    expect(sendPayment).toHaveBeenCalledWith(expect.stringMatching(/^lnbc/))
  })
})
