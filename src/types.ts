export type LnUrlPayResponse = {
  callback: string
  fixed: boolean
  min: number
  max: number
  domain?: string
  metadata: Array<Array<string>>
  metadataHash: string
  identifier: string
  description: string
  image: string
  commentAllowed: number
  rawData: { [key: string]: string | number }
}

export type InvoiceArgs = {
  pr: string;
  verify?: string;
  preimage?: string;
}