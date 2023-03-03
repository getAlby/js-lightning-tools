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
  allowsNostr: boolean
}

export type InvoiceArgs = {
  pr: string;
  verify?: string;
  preimage?: string;
}

export type Event = {
  id?: string;
  kind: number;
  pubkey?: string;
  content: string;
  tags: string[][];
  created_at: number;
  sig?: string;
};

export type ZapArgs = {
  amount: number
  comment?: string
  relays: string[]
  p: string // nostr pubkey of person you are zapping
  e?: string // note you are zapping, optional
}