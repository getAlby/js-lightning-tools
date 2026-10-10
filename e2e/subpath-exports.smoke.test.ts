import { fetch402 } from '@getalby/lightning-tools/402'
import { fetchWithL402 } from '@getalby/lightning-tools/402/l402'
import { fetchWithMpp } from '@getalby/lightning-tools/402/mpp'
import { fetchWithX402 } from '@getalby/lightning-tools/402/x402'
import { Invoice } from '@getalby/lightning-tools/bolt11'
import { getFiatCurrencies } from '@getalby/lightning-tools/fiat'
import { LightningAddress } from '@getalby/lightning-tools/lnurl'
import { sendBoostagram } from '@getalby/lightning-tools/podcasting'

describe('e2e: package.json export subpaths', () => {
  test('resolve like consumer imports', () => {
    expect(Invoice).toBeDefined()
    expect(getFiatCurrencies).toBeDefined()
    expect(LightningAddress).toBeDefined()
    expect(fetch402).toBeDefined()
    expect(fetchWithL402).toBeDefined()
    expect(fetchWithX402).toBeDefined()
    expect(fetchWithMpp).toBeDefined()
    expect(sendBoostagram).toBeDefined()
  })
})
