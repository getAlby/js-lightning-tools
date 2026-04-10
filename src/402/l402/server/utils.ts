/**
 * Server: create a WWW-Authenticate header for a given macaroon and invoice
 * @param args the macaroon/token and invoice generated for the client's request
 * @returns the header value
 */
export const makeL402AuthenticateHeader = (args: {
  token?: string;
  invoice: string;
}) => {
  if (!args.token) {
    throw new Error("token must be provided");
  }

  return `L402 version="0" token="${args.token}", invoice="${args.invoice}"`;
};

/**
 * Server: parse "authorization" header sent from client
 * @param input value from authorization header
 * @returns the macaroon and preimage
 */
export function parseL402Authorization(
  input: string,
): { token: string; preimage: string } | null {
  // Backwards compat: LSAT was the former name of L402
  const normalized = input.replace(/^LSAT /, "L402 ");
  const prefix = "L402 ";
  if (!normalized.startsWith(prefix)) return null;
  const credentials = normalized.slice(prefix.length);
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Invalid authorization header value");
  }
  return {
    token: credentials.slice(0, colonIndex),
    preimage: credentials.slice(colonIndex + 1),
  };
}
