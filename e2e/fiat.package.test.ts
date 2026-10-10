import { readFileSync } from 'fs'
import { join } from 'path'
import fetchMock from 'jest-fetch-mock'
import {
  getFiatCurrencies,
  getSatoshiValue
} from '@getalby/lightning-tools/fiat'

const fixtureDir = join(process.cwd(), 'e2e', 'fixtures')
const fixture = (name: string) => readFileSync(join(fixtureDir, name), 'utf-8')

describe('e2e: fiat (package imports)', () => {
  beforeEach(() => {
    fetchMock.resetMocks()
  })

  test('currencies list then satoshi conversion for 1 USD', async () => {
    fetchMock.mockResponseOnce(fixture('fiat-currencies.json'))
    const currencies = await getFiatCurrencies()
    expect(currencies.map((c) => c.code)).toEqual(['USD', 'EUR'])
    expect(currencies.find((c) => c.code === 'BTC')).toBeUndefined()

    fetchMock.mockResponseOnce(fixture('fiat-usd-rate.json'))
    const sats = await getSatoshiValue({ amount: 1, currency: 'USD' })
    const ratePerSat = 100000 / 100_000_000
    expect(sats).toBe(Math.floor(1 / ratePerSat))
  })
})
