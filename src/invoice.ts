import { decodeInvoice } from "./utils/invoice";
import { InvoiceArgs } from "./types";
import { sha256 } from "./utils/sha256";
import { fromHexString } from "./utils/hex";

export default class Invoice {
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
  }

  async isPaid(): Promise<boolean> {
    if (this.preimage) return this.validatePreimage(this.preimage);
    else if (this.verify) {
      return await this.verifyPayment();
    } else {
      throw new Error("Could not verify payment");
    }
  }

  async validatePreimage(preimage: string): Promise<boolean> {
    if (!preimage || !this.paymentHash) return false;

    try {
      const preimageHash = await sha256(fromHexString(preimage));
      return this.paymentHash === preimageHash;
    } catch {
      return false;
    }
  }

  async verifyPayment(): Promise<boolean> {
    const maxAttempts = 3; // Number of retry attempts
    const retryDelay = 1000; // Delay between attempts in milliseconds

    if (!this.verify) throw new Error("LNURL verify not available");

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fetch(this.verify);

        if (result.ok) {
          const json = await result.json();
          if (json.preimage) {
            this.preimage = json.preimage;
          }
          return json.settled;
        } else {
          console.error(`Network response was not ok: ${result.statusText}`);
        }
      } catch (error) {
        console.error("Network response was not ok:  ", error);
      }

      if (attempt < maxAttempts) {
        console.info(`Retrying... (${maxAttempts - attempt} attempts left)`);
        await new Promise((res) => setTimeout(res, retryDelay)); // wait before retrying
      }
    }

    return false;
  }
}
