import jestFetchMock from "jest-fetch-mock";
import crypto from "crypto";

jestFetchMock.enableMocks();

Object.defineProperty(globalThis, "crypto", {
  value: {
    subtle: crypto.webcrypto.subtle,
  },
});
