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
