import type {
  LUD18ServicePayerData,
  LnUrlPayResponse,
  LnUrlRawData,
} from "../types";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

const URL_REGEX =
  /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/;

export const isUrl = (url: string | null): url is string => {
  if (!url) return false;
  return URL_REGEX.test(url);
};

export const isValidAmount = ({
  amount,
  min,
  max,
}: {
  amount: number;
  min: number;
  max: number;
}): boolean => {
  return amount > 0 && amount >= min && amount <= max;
};

const TAG_PAY_REQUEST = "payRequest";

// From: https://github.com/dolcalmi/lnurl-pay/blob/main/src/request-pay-service-params.ts
export const parseLnUrlPayResponse = async (
  data: LnUrlRawData,
): Promise<LnUrlPayResponse> => {
  if (data.tag !== TAG_PAY_REQUEST)
    throw new Error("Invalid pay service params");

  const callback = (data.callback + "").trim();
  if (!isUrl(callback)) throw new Error("Callback must be a valid url");

  const min = Math.ceil(Number(data.minSendable || 0));
  const max = Math.floor(Number(data.maxSendable));
  if (!(min && max) || min > max) throw new Error("Invalid pay service params");

  let metadata: Array<Array<string>>;
  let metadataHash: string;
  try {
    metadata = JSON.parse(data.metadata + "");
    metadataHash = bytesToHex(sha256(data.metadata + ""));
  } catch {
    metadata = [];
    metadataHash = bytesToHex(sha256("[]"));
  }

  let email = "";
  let image = "";
  let description = "";
  let identifier = "";
  for (let i = 0; i < metadata.length; i++) {
    const [k, v] = metadata[i];
    switch (k) {
      case "text/plain":
        description = v;
        break;
      case "text/identifier":
        identifier = v;
        break;
      case "text/email":
        email = v;
        break;
      case "image/png;base64":
      case "image/jpeg;base64":
        image = "data:" + k + "," + v;
        break;
    }
  }
  const payerData = data.payerData as LUD18ServicePayerData | undefined;

  let domain: string | undefined;
  try {
    domain = new URL(callback).hostname;
  } catch {
    // fail silently and let domain remain undefined if callback is not a valid URL
  }

  return {
    callback,
    fixed: min === max,
    min,
    max,
    domain,
    metadata,
    metadataHash,
    identifier,
    email,
    description,
    image,
    payerData,
    commentAllowed: Number(data.commentAllowed) || 0,
    rawData: data,
    allowsNostr: data.allowsNostr || false,
  };
};
