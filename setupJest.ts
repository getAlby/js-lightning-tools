import * as crypto from "crypto";
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.crypto = crypto as any;
}

import jestFetchMock from "jest-fetch-mock";

jestFetchMock.enableMocks();
