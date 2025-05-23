export type KeysendResponse = {
  customKey: string;
  customValue: string;
  destination: string;
};

export type LnUrlRawData = {
  tag: string;
  callback: string;
  minSendable: number;
  maxSendable: number;
  metadata: string;
  payerData?: LUD18ServicePayerData;
  commentAllowed?: number;
  allowsNostr?: boolean;
};

export type LnUrlPayResponse = {
  callback: string;
  fixed: boolean;
  min: number;
  max: number;
  domain?: string;
  metadata: Array<Array<string>>;
  metadataHash: string;
  identifier: string;
  email: string;
  description: string;
  image: string;
  commentAllowed?: number;
  rawData: LnUrlRawData;
  allowsNostr: boolean;
  payerData?: LUD18ServicePayerData;
};

export type LUD18ServicePayerData = Partial<{
  name: { mandatory: boolean };
  pubkey: { mandatory: boolean };
  identifier: { mandatory: boolean };
  email: { mandatory: boolean };
  auth: {
    mandatory: boolean;
    k1: string;
  };
}> &
  Record<string, unknown>;

export type LUD18PayerData = Partial<{
  name?: string;
  pubkey?: string;
  identifier?: string;
  email?: string;
  auth?: {
    key: string;
    sig: string;
  };
}> &
  Record<string, unknown>;

export type NostrResponse = {
  names: Record<string, string>;
  relays: Record<string, string[]>;
};

export type InvoiceArgs = {
  pr: string;
  verify?: string;
  preimage?: string;
  successAction?: SuccessAction;
};

export type SuccessAction =
  | {
      tag: "message";
      message: string;
    }
  | {
      tag: "url";
      description: string;
      url: string;
    }; // LUD-09

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
  satoshi: number;
  comment?: string;
  relays: string[];
  p?: string;
  e?: string; // note you are zapping, optional
};

export type NostrProvider = {
  getPublicKey(): Promise<string>;
  signEvent(
    event: Event & {
      pubkey: string;
      id: string;
    },
  ): Promise<Event>;
};

export type ZapOptions = {
  nostr?: NostrProvider;
};

export type RequestInvoiceArgs = {
  satoshi: number;
  comment?: string;
  payerdata?: LUD18PayerData;
};
