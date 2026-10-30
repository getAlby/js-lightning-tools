// Test vector from the x402 `exact` Lightning spec (scheme_exact_lnbtc.md):
// GET https://api.example.com/article/A, empty body, no bound headers, signed
// with the test-only private key 0x01. Validation time is 1700000000.
export const LNBTC_URL = "https://api.example.com/article/A";
export const LNBTC_VALIDATION_TIME_MS = 1700000000 * 1000;
export const LNBTC_INVOICE =
  "lnbc250n1pj48ugqpp54y3u9s8ylemsv8l3ewyzzu0klhujvuvmkl6llchq23vy8rzjsf0qsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp5p4nz8am4uqj4q8a87z3sk4x6yk4dv2mvel34epw68qqkwy0xcqvqxqzfvcqpjr4rx6ls6j5rpwknuea64evlk7yfx56wmqcer5eerekdsn9tlv6v4ex9mlz5dtm9qapl3svwlqcf7837dmjkru9z9w4h2rvm0md52w2sqxrwu5f";
export const LNBTC_PREIMAGE =
  "0001020304050607080900010203040506070809000102030405060708090102";
export const LNBTC_REQUIREMENTS = {
  scheme: "exact",
  network: "lnbtc:000000000019d6689c085ae165831e93",
  amount: "25000",
  asset: "BTC",
  payTo: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "bolt11",
    paymentFlow: "upfront",
    requestHash:
      "0d6623f775e025501fa7f0a30b54da25aad62b6ccfe35c85da38016711e6c018",
    requestBindingProfile: "http:1",
    requestBindingParams: { headers: [] as string[] },
    invoice: LNBTC_INVOICE,
  },
};

// A real signed signet challenge captured from https://fortune.mutinynet.com/x402
// (GET, empty body, no bound headers). Its invoice was created at 1793354316.
export const SIGNET_URL = "https://fortune.mutinynet.com/x402";
export const SIGNET_VALIDATION_TIME_MS = 1793354316 * 1000;
export const SIGNET_REQUIREMENTS = {
  scheme: "exact",
  network: "lnbtc:00000008819873e925422c1ff0f99f7c",
  amount: "100000",
  asset: "BTC",
  payTo: "02465ed5be53d04fde66c9418ff14a5f2267723810176c9212b722e542dc1afb1b",
  maxTimeoutSeconds: 300,
  extra: {
    assetTransferMethod: "bolt11",
    invoice:
      "lntbs1u1p4wg6jvpp56l8fe4rq2a2s0qezmwrpwjhsvq0ys5s28qj8ktf3dklsmfzevmwshp5e3uzm759236nkx84utats6w72cp8rysfax9pn9rg73y23f9c82lscqzzsxqzfvsp5tr2lqphsl5dj3dxx08hp4kzsdsnxct3vq505wuxdys383kf4mlss9qxpqysgqvvxf7gkgyf24y0aaf80p6h2yuaz04krt84386ha75hu97yc4wdvxu5vgprzcrl4l42lr7ngsluukyxcvukyyt9agg3c4lk5vyrywxscqwktu80",
    paymentFlow: "upfront",
    requestBindingParams: {
      headers: [],
    },
    requestBindingProfile: "http:1",
    requestHash:
      "cc782dfa8554753b18f5e2fab869de5602719209e98a199468f448a8a4b83abf",
  },
};
