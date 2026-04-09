/**
 * Server: create a WWW-Authenticate header for a given macaroon and invoice
 * @param args the macaroon/token and invoice generated for the client's request
 * @returns the header value
 */
export const makeL402AuthenticateHeader = (args: {
  macaroon?: string;
  token?: string;
  invoice: string;
}) => {
  if (!args.macaroon && !args.token) {
    throw new Error(
      "makeL402AuthenticateHeader: one of macaroon or token must be provided",
    );
  }
  if (args.macaroon) {
    return `L402 version="0" macaroon="${args.macaroon}", invoice="${args.invoice}"`;
  } else {
    return `L402 version="0" token="${args.token}", invoice="${args.invoice}"`;
  }
};

/**
 * Server: parse "authorization" header sent from client
 * @param input value from authorization header
 * @returns the macaroon and preimage
 */
export function parseL402Authorization(
  input: string,
): { macaroon: string; preimage: string } | null {
  const prefix = "L402 ";
  if (!input.startsWith(prefix)) return null;
  const credentials = input.slice(prefix.length);
  const colonIndex = credentials.indexOf(":");
  if (colonIndex === -1) {
    throw new Error("Invalid authorization header value");
  }
  return {
    macaroon: credentials.slice(0, colonIndex),
    preimage: credentials.slice(colonIndex + 1),
  };
}
