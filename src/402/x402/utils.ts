export interface X402Requirements {
  scheme: string;
  network: string;
  extra: {
    invoice: string;
    paymentMethod?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const buildX402PaymentSignature = (
  scheme: string,
  network: string,
  invoice: string,
  requirements: X402Requirements,
): string => {
  const json = JSON.stringify({
    x402Version: 2,
    scheme,
    network,
    payload: { invoice },
    accepted: requirements,
  });
  // btoa only handles latin1; encode via UTF-8 to be safe
  return btoa(unescape(encodeURIComponent(json)));
};
