import fetchMock from 'jest-fetch-mock'
import { fetch402 } from '@getalby/lightning-tools/402'
import { makeL402AuthenticateHeader } from '@getalby/lightning-tools/402/l402'
import {
  encodeMppChargeRequest,
  makeMppWwwAuthenticateHeader,
  type MppChargeRequest
} from '../src/402/mpp/utils'

const MACAROON =
  'AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ=='
const L402_INVOICE =
  'lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz'
const PREIMAGE =
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

const MPP_INVOICE =
  'lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz'
const CHALLENGE_ID = 'kM9xPqWvT2nJrHsY4aDfEb'
const REALM = 'api.example.com'
const CHARGE_REQUEST: MppChargeRequest = {
  amount: '10',
  currency: 'sat',
  methodDetails: {
    invoice: MPP_INVOICE,
    network: 'mainnet'
  }
}
const ENCODED_REQUEST = encodeMppChargeRequest(CHARGE_REQUEST)

const X402_INVOICE =
  'lnbc4020n1p5m6028dq80q6rqvsnp4qt5w34u6kntf5lc50jj27rvs89sgrpcpj7s6vfts042gkhxx2j6swpp5g6tquvmswkv5xf0ru7ju2qvdrf83l2ewha3qzzt0a7vurs5q30rssp54kt5hfzjngjersx8fgt60feuu8e7vnat67f3ksr98twdj7z0m0ls9qyysgqcqzp2xqyz5vqrzjqdc22wfv6lyplagj37n9dmndkrzdz8rh3lxkewvvk6arkjpefats2rf47yqqwysqqcqqqqlgqqqqqqgqfqrzjq26922n6s5n5undqrf78rjjhgpcczafws45tx8237y7pzx3fg8ww8apyqqqqqqqqjyqqqqlgqqqqr4gq2q3z5pu33awfm98ac3ysdhy046xmen4zqval67tccu35x9mxgvl6w3wmq6y03ae7pme6qr20mp5gvuqntnu8yy7nlf6gyt9zshanj2zhgqe4xde3'
const X402_PREIMAGE =
  '8196e90022ce688d911554d02af67d3d6a72143961c1e1aa12c4720538ea0549'

const X402_REQUIREMENTS = {
  scheme: 'exact',
  network: 'bip122:000000000019d6689c085ae165831e93',
  amount: '402000',
  asset: 'btc',
  extra: { invoice: X402_INVOICE, paymentMethod: 'lightning' }
}

function makePaymentRequiredHeader() {
  return btoa(
    unescape(
      encodeURIComponent(JSON.stringify({ accepts: [X402_REQUIREMENTS] }))
    )
  )
}

describe('e2e: fetch402 router (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('returns response when no payment challenge', async () => {
    const wallet = { payInvoice: jest.fn() }
    fetchMock.mockResponseOnce(JSON.stringify({ tier: 'free' }), {
      status: 200
    })

    const response = await fetch402(
      'https://example.com/resource',
      {},
      { wallet }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ tier: 'free' })
    expect(wallet.payInvoice).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('routes L402 www-authenticate to wallet and retry', async () => {
    const wallet = {
      payInvoice: jest.fn().mockResolvedValue({ preimage: PREIMAGE })
    }

    fetchMock.mockResponseOnce('Payment Required', {
      status: 402,
      headers: {
        'www-authenticate': makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: L402_INVOICE
        })
      }
    })
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true }), { status: 200 })

    const response = await fetch402('https://example.com/l402', {}, { wallet })

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: L402_INVOICE })
    expect(response.status).toBe(200)
    const second = fetchMock.mock.calls[1][1] as RequestInit
    expect((second.headers as Headers).get('Authorization')).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`
    )
  })

  test('routes MPP Payment www-authenticate to wallet and retry', async () => {
    const wallet = {
      payInvoice: jest.fn().mockResolvedValue({ preimage: PREIMAGE })
    }

    fetchMock.mockResponseOnce('Payment Required', {
      status: 402,
      headers: {
        'www-authenticate': makeMppWwwAuthenticateHeader({
          id: CHALLENGE_ID,
          realm: REALM,
          request: ENCODED_REQUEST
        })
      }
    })
    fetchMock.mockResponseOnce(JSON.stringify({ paid: true }), { status: 200 })

    const response = await fetch402('https://example.com/mpp', {}, { wallet })

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: MPP_INVOICE })
    expect(response.status).toBe(200)
    const second = fetchMock.mock.calls[1][1] as RequestInit
    expect((second.headers as Headers).get('Authorization')).toMatch(
      /^Payment /
    )
  })

  test('routes PAYMENT-REQUIRED (x402) when no www-authenticate', async () => {
    const wallet = {
      payInvoice: jest.fn().mockResolvedValue({ preimage: X402_PREIMAGE })
    }

    fetchMock.mockResponseOnce('Payment Required', {
      status: 402,
      headers: { 'PAYMENT-REQUIRED': makePaymentRequiredHeader() }
    })
    fetchMock.mockResponseOnce(JSON.stringify({ content: 'x402 ok' }), {
      status: 200
    })

    const response = await fetch402('https://example.com/x402', {}, { wallet })

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: X402_INVOICE })
    expect(response.status).toBe(200)
    const second = fetchMock.mock.calls[1][1] as RequestInit
    expect((second.headers as Headers).get('payment-signature')).toBeTruthy()
  })
})
