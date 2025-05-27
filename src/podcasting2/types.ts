export type BoostOptions = {
  webln?: unknown;
};

export type BoostArguments = {
  destination: string;
  customKey?: string;
  customValue?: string;
  amount?: number;
  boost: Boost;
};

export type WeblnBoostParams = {
  destination: string;
  amount: number;
  customRecords: Record<string, string>;
};

export type Boost = {
  action: string;
  value_msat: number;
  value_msat_total: number;
  app_name: string;
  app_version: string;
  feedId: string;
  podcast: string;
  episode: string;
  ts: number;
  name: string;
  sender_name: string;
};
