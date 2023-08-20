import { decode } from "light-bolt11-decoder";

export const getHashFromInvoice = (invoice) => {
  if (!invoice) return null;

  try {
    const decoded = decode(invoice);
    if (!decoded || !decoded.sections) return null;

    const hashTag = decoded.sections.find(
      (value) => value.name === "payment_hash",
    );
    if (!hashTag || !hashTag.value) return null;

    return hashTag.value.toString();
  } catch {
    return null;
  }
};
