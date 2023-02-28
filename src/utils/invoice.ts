import { decode } from 'bolt11';

export const getHashFromInvoice = (invoice: string): string | null => {
  if (!invoice) return null

  try {
    const decoded = decode(invoice)
    if (!decoded || !decoded.tags) return null

    const hashTag = decoded.tags.find(
      (value) => value.tagName === 'payment_hash'
    )
    if (!hashTag || !hashTag.data) return null

    return hashTag.data.toString()
  } catch {
    return null
  }
}