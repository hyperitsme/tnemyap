import crypto from "crypto";
import { ulid } from "ulid";
import { CONFIG } from "./config.js";
import { q } from "./db.js";
import { hmacBase64 } from "./utils/hmac.js";

/** Create a quote and persist to DB */
export async function makeQuote({ price, resource }) {
  const nonce = crypto.randomBytes(6).toString("hex");
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

/** Parse header: "tx=0x..; payer=0x..; nonce=abc" */
export function parseProofHeader(proofHeader) {
  const parts = Object.fromEntries(
    proofHeader.split(";").map(kv => {
      const [k, v] = kv.split("=").map(s => s.trim());
      return [k, (v || "").replace(/^"|"$/g, "")];
    })
  );
  return { tx: parts.tx, payer: parts.payer, nonce: parts.nonce };
}

/** Mark quote used and insert receipt */
export async function settleReceipt({ nonce, chain, txHash, payer, amountWei, decimals }) {
  await q("update quotes set used=true where nonce=$1", [nonce]);
  const id = ulid();
  const amount = Number(amountWei) / (10 ** decimals);
  await q(
    "insert into receipts(id, nonce, chain, tx_hash, payer, amount, verified) values($1,$2,$3,$4,$5,$6,$7)",
    [id, nonce, chain, txHash, payer || null, amount, true]
  );
}
