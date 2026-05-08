import fetchMock from 'jest-fetch-mock'
import {
  fetchWithL402,
  makeL402AuthenticateHeader
} from '@getalby/lightning-tools/402/l402'

const MACAROON =
  'AgEEbHNhdAJCAAAClGOZrh7C569Yc7UMk8merfnMdIviyXr1qscW7VgpChNl21LkZ8Jex5QiPp+E1VaabeJDuWmlrh/j583axFpNAAIXc2VydmljZXM9cmFuZG9tbnVtYmVyOjAAAiZyYW5kb21udW1iZXJfY2FwYWJpbGl0aZVzPWFkZCxzdWJ0cmFjdAAABiAvFpzXGyc+8d/I9nMKKvAYP8w7kUlhuxS0eFN2sqmqHQ=='
const INVOICE =
  'lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz'
const PREIMAGE =
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

const L402_URL = 'https://example.com/e2e-protected'

describe('e2e: L402 fetchWithL402 (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('402 challenge then authorized retry', async () => {
    const wallet = {
      payInvoice: jest.fn().mockResolvedValue({ preimage: PREIMAGE })
    }

    fetchMock.mockResponseOnce('Payment Required', {
      status: 402,
      headers: {
        'www-authenticate': makeL402AuthenticateHeader({
          token: MACAROON,
          invoice: INVOICE
        })
      }
    })
    fetchMock.mockResponseOnce(JSON.stringify({ ok: true, tier: 'paid' }), {
      status: 200
    })

    const response = await fetchWithL402(L402_URL, {}, { wallet })

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, tier: 'paid' })

    const secondInit = fetchMock.mock.calls[1][1] as RequestInit
    expect((secondInit.headers as Headers).get('Authorization')).toBe(
      `L402 ${MACAROON}:${PREIMAGE}`
    )
  })
})
