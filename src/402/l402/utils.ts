interface WwwAuthenticatePayload {
  token: string;
  invoice: string;
  [key: string]: string; // Allows any other string properties
}

/**
 * Client: parse "www-authenticate" header from server response
 * @param input
 * @returns details from the header value (token or macaroon, invoice)
 */
export const parseL402 = (input: string): WwwAuthenticatePayload => {
  // Remove the L402 and LSAT identifiers
  const string = input.replace("L402", "").replace("LSAT", "").trim();

  // Initialize an object to store the key-value pairs
  const keyValuePairs: Record<string, string> = {};

  // Regular expression to match key and (quoted or unquoted) value
  const regex = /(\w+)=("([^"]*)"|'([^']*)'|([^,]*))/g;
  let match;

  // Use regex to find all key-value pairs
  while ((match = regex.exec(string)) !== null) {
    // Key is always match[1]
    // Value is either match[3] (double-quoted), match[4] (single-quoted), or match[5] (unquoted)
    keyValuePairs[match[1]] = match[3] || match[4] || match[5];
  }

  if (!keyValuePairs["token"] && keyValuePairs["macaroon"]) {
    // fallback to old naming
    keyValuePairs["token"] = keyValuePairs["macaroon"];
    delete keyValuePairs["macaroon"];
  }

  if (
    !("token" in keyValuePairs) ||
    typeof keyValuePairs["token"] !== "string"
  ) {
    throw new Error("No macaroon or token found in www-authenticate header");
  }
  if (
    !("invoice" in keyValuePairs) ||
    typeof keyValuePairs["invoice"] !== "string"
  ) {
    throw new Error("No invoice found in www-authenticate header");
  }

  return keyValuePairs as WwwAuthenticatePayload;
};
