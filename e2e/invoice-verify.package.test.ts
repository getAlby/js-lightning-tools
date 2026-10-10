import { readFileSync } from 'fs'
import { join } from 'path'
import fetchMock from 'jest-fetch-mock'
import { Invoice } from '@getalby/lightning-tools/bolt11'

const fixtureDir = join(process.cwd(), 'e2e', 'fixtures')
const fixtureJson = (name: string) =>
  JSON.parse(readFileSync(join(fixtureDir, name), 'utf-8'))

describe('e2e: Invoice.verifyPayment (package import)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('LNURL verify JSON settled true', async () => {
    const data = fixtureJson('lnurlp-callback-invoice.json')
    fetchMock.mockResponseOnce(JSON.stringify({ settled: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

    const invoice = new Invoice({
      pr: data.pr,
      verify: data.verify
    })

    expect(await invoice.verifyPayment()).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe(data.verify)
  })
})
