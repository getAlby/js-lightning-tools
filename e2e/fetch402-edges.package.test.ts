import { readFileSync } from 'fs'
import { join } from 'path'
import fetchMock from 'jest-fetch-mock'
import { fetch402 } from '@getalby/lightning-tools/402'
import { makeL402AuthenticateHeader } from '@getalby/lightning-tools/402/l402'
import { Invoice } from '@getalby/lightning-tools/bolt11'

const fixtureDir = join(process.cwd(), 'e2e', 'fixtures')
const fixtureJson = (name: string) =>
  JSON.parse(readFileSync(join(fixtureDir, name), 'utf-8'))

const MACAROON =
  'AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ=='

describe('e2e: fetch402 edge cases (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('throws on unsupported WWW-Authenticate scheme', async () => {
    const wallet = { payInvoice: jest.fn() }
    fetchMock.mockResponseOnce('Unauthorized', {
      status: 401,
      headers: { 'www-authenticate': 'Basic realm="api"' }
    })

    await expect(
      fetch402('https://example.com/r', {}, { wallet })
    ).rejects.toThrow('fetch402: unsupported WWW-Authenticate scheme')
    expect(wallet.payInvoice).not.toHaveBeenCalled()
  })

  test('maxAmount rejects invoice before calling inner wallet', async () => {
    const data = fixtureJson('lnurlp-callback-invoice.json')
    const decoded = new Invoice({ pr: data.pr })
    const innerWallet = { payInvoice: jest.fn() }

    fetchMock.mockResponseOnce('Payment Required', {
      status: 402,
      headers: {
        'www-authenticate': makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: data.pr
        })
      }
    })

    await expect(
      fetch402(
        'https://example.com/guarded',
        {},
        { wallet: innerWallet, maxAmount: decoded.satoshi - 1 }
      )
    ).rejects.toThrow(/exceeds maxAmount/)

    expect(innerWallet.payInvoice).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
