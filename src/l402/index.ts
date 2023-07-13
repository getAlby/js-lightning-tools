import MemoryStorage from "../utils/Storage";
import { WebLNProvider } from '@webbtc/webln-types';
import { parseL402 } from "./parse";

export * as storage from "../utils/Storage";
const memoryStorage = new MemoryStorage();

const HEADER_KEY = "L402"; // we have to update this to L402 at some point

export const fetchWithL402 = async (url: string, fetchArgs: Record<string, any>, options: Record<string, any>) => {
  if (!options) {
    options = {};
  }
  const headerKey = options.headerKey || HEADER_KEY;
  const webln: WebLNProvider = options.webln || globalThis.webln;
  if (!webln) {
    throw new Error("WebLN is missing");
  }
  let store = options.store || memoryStorage;
  if (!fetchArgs) {
    fetchArgs = {};
  }
  fetchArgs.cache = 'no-store';
  fetchArgs.mode = 'cors';
  if (!fetchArgs.headers) {
    fetchArgs.headers = {};
  }
  const cachedL402Data = store.getItem(url);
  if (cachedL402Data) {
    const data = JSON.parse(cachedL402Data);
    fetchArgs.headers["Authorization"] = `${headerKey} ${data.token}:${data.preimage}`;
    return await fetch(url, fetchArgs)
  }

  fetchArgs.headers["Accept-Authenticate"] = headerKey;
  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get('www-authenticate');
  if (!header) {
    return initResp
  }

  const details = parseL402(header);
  const token = details.token || details.macaroon;
  const inv = details.invoice;

  await webln.enable();
  const invResp = await webln.sendPayment(inv);

  store.setItem(url, JSON.stringify({
    'token': token,
    'preimage': invResp.preimage
  }));

  fetchArgs.headers["Authorization"] = `${headerKey} ${token}:${invResp.preimage}`;
  return await fetch(url, fetchArgs);
}

export default fetchWithL402;
