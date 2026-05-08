import { sendBoostagram } from '@getalby/lightning-tools/podcasting'

describe('e2e: sendBoostagram (package import)', () => {
  test('calls WebLN keysend with boostagram record', async () => {
    const webln = {
      enable: jest.fn().mockResolvedValue(undefined),
      keysend: jest.fn().mockResolvedValue({})
    }

    const boost = {
      action: 'boost',
      value_msat: 5000,
      value_msat_total: 5000,
      app_name: 'e2e',
      app_version: '1.0.0',
      feedId: 'feed',
      podcast: 'Pod',
      episode: 'Ep1',
      ts: 1,
      name: 'listener',
      sender_name: 'anon'
    }

    await sendBoostagram(
      {
        destination:
          '030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3',
        amount: 5,
        boost
      },
      { webln: webln as never }
    )

    expect(webln.enable).toHaveBeenCalled()
    expect(webln.keysend).toHaveBeenCalledWith(
      expect.objectContaining({
        destination:
          '030a58b8653d32b99200a2334cfe913e51dc7d155aa0116c176657a4f1722677a3',
        amount: 5,
        customRecords: expect.objectContaining({
          '7629169': expect.stringContaining('value_msat')
        }) as Record<string, string>
      })
    )
  })
})
