import { InvoiceArgs, SuccessAction } from "./types";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import { decodeInvoice, fromHexString } from "./utils";

export class Invoice {
  paymentRequest: string;
  paymentHash: string;
  preimage: string | null;
  verify: string | null;
  satoshi: number;
  expiry: number | undefined; // expiry in seconds (not a timestamp)
  timestamp: number; // created date in seconds
  createdDate: Date;
  expiryDate: Date | undefined;
  description: string | null;
  successAction: SuccessAction | null;

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
    this.expiryDate = this.expiry
      ? new Date((this.timestamp + this.expiry) * 1000)
      : undefined;
    this.description = decodedInvoice.description ?? null;
    this.verify = args.verify ?? null;
    this.preimage = args.preimage ?? null;
    this.successAction = args.successAction ?? null;
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
      const preimageHash = bytesToHex(sha256(fromHexString(preimage)));
      return this.paymentHash === preimageHash;
    } catch {
      return false;
    }
  }

  async verifyPayment(): Promise<boolean> {
    try {
      if (!this.verify) {
        throw new Error("LNURL verify not available");
      }
      const response = await fetch(this.verify);
      if (!response.ok) {
        throw new Error(
          `Verification request failed: ${response.status} ${response.statusText}`,
        );
      }
      const json = await response.json();
      if (json.preimage) {
        this.preimage = json.preimage;
      }

      return json.settled;
    } catch (error) {
      console.error("Failed to check LNURL-verify", error);
      return false;
    }
  }

  hasExpired() {
    const { expiryDate } = this;
    if (expiryDate) {
      return expiryDate.getTime() < Date.now();
    }
    return false;
  }
}
