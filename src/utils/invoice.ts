import { decode } from "light-bolt11-decoder";

type DecodedInvoice = {
  paymentHash: string;
  satoshi: number;
  timestamp: number;
  expiry: number;
  description: string | undefined;
};

export const decodeInvoice = (
  paymentRequest: string,
): DecodedInvoice | null => {
  if (!paymentRequest) return null;

  try {
    const decoded = decode(paymentRequest);
    if (!decoded || !decoded.sections) return null;

    const hashTag = decoded.sections.find(
      (value) => value.name === "payment_hash",
    );

    if (hashTag?.name !== "payment_hash" || !hashTag.value) return null;

    const paymentHash = hashTag.value;

    const amountTag = decoded.sections.find((value) => value.name === "amount");

    if (amountTag?.name !== "amount" || amountTag.value === undefined)
      return null;

    const satoshi = parseInt(amountTag.value) / 1000; // millisats

    const expiryTag = decoded.sections.find((value) => value.name === "expiry");

    const timestampTag = decoded.sections.find(
      (value) => value.name === "timestamp",
    );

    if (timestampTag?.name !== "timestamp" || !timestampTag.value) return null;

    const timestamp = timestampTag.value;

    if (expiryTag?.name !== "expiry" || expiryTag.value === undefined)
      return null;

    const expiry = expiryTag.value;

    const descriptionTag = decoded.sections.find(
      (value) => value.name === "description",
    );

    const description =
      descriptionTag?.name === "description"
        ? descriptionTag?.value
        : undefined;

    return {
      paymentHash,
      satoshi,
      timestamp,
      expiry,
      description,
    };
  } catch {
    return null;
  }
};
