import fetchMock from 'jest-fetch-mock'
import { fetchWithX402 } from '@getalby/lightning-tools/402/x402'

const INVOICE =
  'lnbc4020n1p5m6028dq80q6rqvsnp4qt5w34u6kntf5lc50jj27rvs89sgrpcpj7s6vfts042gkhxx2j6swpp5g6tquvmswkv5xf0ru7ju2qvdrf83l2ewha3qzzt0a7vurs5q30rssp54kt5hfzjngjersx8fgt60feuu8e7vnat67f3ksr98twdj7z0m0ls9qyysgqcqzp2xqyz5vqrzjqdc22wfv6lyplagj37n9dmndkrzdz8rh3lxkewvvk6arkjpefats2rf47yqqwysqqcqqqqlgqqqqqqgqfqrzjq26922n6s5n5undqrf78rjjhgpcczafws45tx8237y7pzx3fg8ww8apyqqqqqqqqjyqqqqlgqqqqr4gq2q3z5pu33awfm98ac3ysdhy046xmen4zqval67tccu35x9mxgvl6w3wmq6y03ae7pme6qr20mp5gvuqntnu8yy7nlf6gyt9zshanj2zhgqe4xde3'
const PREIMAGE =
  '8196e90022ce688d911554d02af67d3d6a72143961c1e1aa12c4720538ea0549'

const REQUIREMENTS = {
  scheme: 'exact',
  network: 'bip122:000000000019d6689c085ae165831e93',
  amount: '402000',
  asset: 'btc',
  extra: { invoice: INVOICE, paymentMethod: 'lightning' }
}

function makePaymentRequiredHeader() {
  return btoa(
    unescape(encodeURIComponent(JSON.stringify({ accepts: [REQUIREMENTS] })))
  )
}

describe('e2e: fetchWithX402 (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('402 with PAYMENT-REQUIRED then paid resource', async () => {
    const wallet = {
      payInvoice: jest.fn().mockResolvedValue({ preimage: PREIMAGE })
    }

    fetchMock.mockResponseOnce('Payment Required', {
      status: 402,
      headers: { 'PAYMENT-REQUIRED': makePaymentRequiredHeader() }
    })
    fetchMock.mockResponseOnce(JSON.stringify({ data: 'paid' }), {
      status: 200
    })

    const response = await fetchWithX402(
      'https://example.com/x402-protected',
      {},
      { wallet }
    )

    expect(wallet.payInvoice).toHaveBeenCalledWith({ invoice: INVOICE })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: 'paid' })
  })
})
