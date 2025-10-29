import { CONFIG } from "./config.js";
import { q } from "./db.js";
import { hmacBase64 } from "./utils/hmac.js";

/** Buat quote + simpan di DB */
export async function makeQuote({ price, resource }) {
  const nonce = cryptoRandom(6);
  const expiry = new Date(Date.now() + CONFIG.QUOTE_TTL_SEC * 1000).toISOString();

  const row = {
    nonce,
    resource,
    price: String(price),
    symbol: CONFIG.EVM.SYMBOL,
    chain: "base",
    token: CONFIG.EVM.TOKEN,
    decimals: CONFIG.EVM.DECIMALS,
    pay_to: CONFIG.EVM.MERCHANT,
    expiry
  };

  const json = JSON.stringify({
    price: row.price,
    symbol: row.symbol,
    chain: row.chain,
    token: row.token,
    decimals: row.decimals,
    to: row.pay_to,
    nonce: row.nonce,
    expiry: row.expiry,
    resource: row.resource
  });

  const sig = hmacBase64(json);

  await q(
    `insert into quotes(nonce,resource,price,symbol,chain,token,decimals,pay_to,expiry)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [row.nonce,row.resource,row.price,row.symbol,row.chain,row.token,row.decimals,row.pay_to,row.expiry]
  );

  return { row, sig };
}

function cryptoRandom(bytes) {
  return (await import("crypto")).randomBytes(bytes).toString("hex");
}
