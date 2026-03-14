import type { Config } from "ts-jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFiles: ["./setupJest.ts"],
};

export default config;