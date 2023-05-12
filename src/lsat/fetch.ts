import fetch from '@inrupt/universal-fetch';
import MemoryStorage from "../utils/Storage";
import NoStorage from "../utils/Storage";
import { WebLNProvider } from '@webbtc/webln-types';

export * as Storage from "../utils/Storage";
const memoryStorage = new MemoryStorage();

export const fetchWithLsat = async (url: string, fetchArgs: Record<string, any>, options: Record<string, any>) => {
  if (!options) {
    options = {};
  }
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
  const cachedLsatData = store.getItem(url);
  if (cachedLsatData) {
    const data = JSON.parse(cachedLsatData);
    fetchArgs.headers["Authorization"] = `LSAT ${data.mac}:${data.preimage}`;
    return await fetch(url, fetchArgs)
  }

  fetchArgs.headers["Accept-Authenticate"] = "LSAT";
  const initResp = await fetch(url, fetchArgs);
  const header = initResp.headers.get('www-authenticate');
  if (!header) {
    return initResp
  }

  const parts = header.split(",");
  const mac = parts[0].replace("LSAT macaroon=", "").trim();
  const inv = parts[1].replace("invoice=", "").trim();

  await webln.enable();
  const invResp = await webln.sendPayment(inv);

  store.setItem(url, JSON.stringify({
    'mac': mac,
    'preimage': invResp.preimage
  }));

  fetchArgs.headers["Authorization"] = `LSAT ${mac}:${invResp.preimage}`;
  return await fetch(url, fetchArgs);
}

export default fetchWithLsat;
