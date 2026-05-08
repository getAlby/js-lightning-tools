import fetchMock from 'jest-fetch-mock'
import { fetchWithMpp } from '@getalby/lightning-tools/402/mpp'
import {
  encodeMppChargeRequest,
  makeMppWwwAuthenticateHeader,
  type MppChargeRequest
} from '../src/402/mpp/utils'

const INVOICE =
  'lnbc100n1pjkse4mpp5q22x8xdwrmpw0t6cww6sey7fn6klnnr5303vj7h44tr3dm2c9y9qdq8f4f5z4qcqzzsxqyz5vqsp5mmhp6cx4xxysc8xvxaj984eue9pm83lxgezmk3umx6wxr9rrq2ns9qyyssqmmrrwthves6z3d85nafj2ds4z20qju2vpaatep8uwrvxz0xs4kznm99m7f6pmkzax09k2k9saldy34z0p0l8gm0zm5xsmg2g667pnlqp7a0qdz'
const PREIMAGE =
  'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
const CHALLENGE_ID = 'kM9xPqWvT2nJrHsY4aDfEb'
const REALM = 'api.example.com'

const CHARGE_REQUEST: MppChargeRequest = {
  amount: '10',
  currency: 'sat',
  methodDetails: {
    invoice: INVOICE,
    network: 'mainnet'
  }
}
const ENCODED_REQUEST = encodeMppChargeRequest(CHARGE_REQUEST)

describe('e2e: fetchWithMpp (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('402 with Payment lightning/charge then success', async () => {
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
    fetchMock.mockResponseOnce(JSON.stringify({ data: 'mpp ok' }), {
      status: 200
    })

    const response = await fetchWithMpp(
      'https://example.com/mpp-protected',
      {},
      { wallet }
    )

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: 'mpp ok' })
  })
})
