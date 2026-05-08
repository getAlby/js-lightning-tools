import * as pkg from '@getalby/lightning-tools'

describe('e2e: package barrel (index)', () => {
  test('exports expected public surface', () => {
    expect(pkg.LightningAddress).toBeDefined()
    expect(pkg.Invoice).toBeDefined()
    expect(pkg.fetchWithL402).toBeDefined()
    expect(pkg.fetch402).toBeDefined()
    expect(pkg.fetchWithX402).toBeDefined()
    expect(pkg.fetchWithMpp).toBeDefined()
    expect(pkg.getFiatCurrencies).toBeDefined()
    expect(pkg.sendBoostagram).toBeDefined()
  })
})
