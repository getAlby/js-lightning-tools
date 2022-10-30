import * as repl from 'node:repl';
import * as alby from "./dist/index.module.js";

const webln = {
  keysend() { console.log(arguments); },
  sendPayment() { console.log(arguments); }
};


const r = repl.start('> ');
r.context.webln = webln;
r.context.alby = alby;
