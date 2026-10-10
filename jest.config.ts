import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["./setupJest.ts"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/e2e/"],
};

export default config;