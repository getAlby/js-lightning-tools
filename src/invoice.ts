import { decodeInvoice } from "./utils/invoice";
import Hex from "crypto-js/enc-hex.js";
import sha256 from "crypto-js/sha256.js";
import { InvoiceArgs } from "./types";

export default class Invoice {
  paymentRequest: string;
  paymentHash: string;
  preimage: string | null;
  verify: string | null;
  satoshi: number;
  expiry: number; // expiry in seconds (not a timestamp)
  timestamp: number; // created date in seconds
  createdDate: Date;
  expiryDate: Date;
  description: string | null;

  constructor(args: InvoiceArgs) {
    this.paymentRequest = args.pr;
    if (!this.paymentRequest) {
      throw new Error("Invalid payment request");
    }
    const decodedInvoice = decodeInvoice(this.paymentRequest);
    if (!decodedInvoice) {
      throw new Error("Failed to decode payment request");
    }
    this.paymentHash = decodedInvoice.paymentHash;
    this.satoshi = decodedInvoice.satoshi;
    this.timestamp = decodedInvoice.timestamp;
    this.expiry = decodedInvoice.expiry;
    this.createdDate = new Date(this.timestamp * 1000);
    this.expiryDate = new Date((this.timestamp + this.expiry) * 1000);
    this.description = decodedInvoice.description ?? null;
    this.verify = args.verify ?? null;
    this.preimage = args.preimage ?? null;
  }

  async isPaid(): Promise<boolean> {
    if (this.preimage) return this.validatePreimage(this.preimage);
    else if (this.verify) {
      return await this.verifyPayment();
    } else {
      throw new Error("Could not verify payment");
    }
  }

  validatePreimage(preimage: string): boolean {
    if (!preimage || !this.paymentHash) return false;

    try {
      const preimageHash = sha256(Hex.parse(preimage)).toString(Hex);
      return this.paymentHash === preimageHash;
    } catch {
      return false;
    }
  }

  async verifyPayment(): Promise<boolean> {
    if (!this.verify) throw new Error("LNURL verify not available");
    const result = await fetch(this.verify);
    const json = await result.json();
    if (json.preimage) {
      this.preimage = json.preimage;
    }

    return json.settled;
  }
}
