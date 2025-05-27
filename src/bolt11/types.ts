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
