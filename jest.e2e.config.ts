import type { Config } from 'jest'

/**
 * Integration-style tests (Jest + Node + jest-fetch-mock).
 * Run with: yarn test:e2e
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/setupJest.ts'],
  testMatch: ['<rootDir>/e2e/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.e2e.json'
      }
    ]
  },
  moduleNameMapper: {
    '^@getalby/lightning-tools$': '<rootDir>/src/index.ts',
    '^@getalby/lightning-tools/bolt11$': '<rootDir>/src/bolt11/index.ts',
    '^@getalby/lightning-tools/fiat$': '<rootDir>/src/fiat/index.ts',
    '^@getalby/lightning-tools/lnurl$': '<rootDir>/src/lnurl/index.ts',
    '^@getalby/lightning-tools/402$': '<rootDir>/src/402/index.ts',
    '^@getalby/lightning-tools/402/l402$': '<rootDir>/src/402/l402/index.ts',
    '^@getalby/lightning-tools/402/x402$': '<rootDir>/src/402/x402/index.ts',
    '^@getalby/lightning-tools/402/mpp$': '<rootDir>/src/402/mpp/index.ts',
    '^@getalby/lightning-tools/podcasting$':
      '<rootDir>/src/podcasting2/index.ts'
  }
}

export default config
