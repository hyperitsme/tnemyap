import express from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { priceFor } from "./priceEngine.js";
import { makeQuote } from "./x402.js";
import { q } from "./db.js";
import { verifyEvmErc20Transfer } from "./verifier/evm.js";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "./redis.js";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (CONFIG.CORS_ORIGINS.includes("*") || !origin) return cb(null, true);
    return cb(null, CONFIG.CORS_ORIGINS.includes(origin));
  }
}));

// Rate limit per IP
const limiter = new RateLimiterRedis({
  storeClient: redis, keyPrefix: "rl",
  points: 100, duration: 60
});
app.use(async (req, res, next) => {
  try { await limiter.consume(req.ip); next(); }
  catch { res.status(429).json({ error: "Too Many Requests" }); }
});

// ============== HEALTH ==========
app.get("/health", (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ============== PROTECTED RESOURCE (contoh) ==========
app.get("/v1/alpha-signal", x402Gate, async (req, res) => {
  res.json({ pair:"BTC-USD", timeframe:"1h", signal:"BULLISH", confidence:0.73, ts:new Date().toISOString() });
});

// ============== X-402 Middleware ==========
async function x402Gate(req, res, next) {
  const proof = req.get("X-402-Proof");
  if (proof) {
    const ok = await verifyProofHeader(proof, req);
    if (!ok.ok) return res.status(402).json({ error: "Invalid X-402 proof", reason: ok.reason });
    return next();
  }
  // Tidak ada proof → kirim 402 dengan quote
  const price = await priceFor(req);
  const { row, sig } = await makeQuote({ price, resource: req.originalUrl });
  res.setHeader("X-402-Price", `${row.price} ${row.symbol}`);
  res.setHeader("X-402-Chain", row.chain);
  res.setHeader("X-402-Token", row.symbol);
  res.setHeader("X-402-TokenAddress", row.token);
  res.setHeader("X-402-Decimals", String(row.decimals));
  res.setHeader("X-402-Address", row.pay_to);
  res.setHeader("X-402-Nonce", row.nonce);
  res.setHeader("X-402-Expiry", row.expiry);
  res.setHeader("X-402-QuoteSig", sig);
  return res.status(402).send("Payment Required");
}

async function verifyProofHeader(proofHeader, req) {
  // format: "tx=0x..; payer=0x..; nonce=abc"
  const parts = Object.fromEntries(proofHeader.split(";").map(kv=>{
    const [k,v] = kv.split("=").map(s=>s.trim());
    return [k, (v||"").replace(/^"|"$/g,"")];
  }));
  const { tx, payer, nonce } = parts;
  if (!tx || !nonce) return { ok:false, reason:"missing tx/nonce" };

  const { rows } = await q("select * from quotes where nonce=$1", [nonce]);
  const quote = rows[0];
  if (!quote) return { ok:false, reason:"nonce not found" };
  if (quote.used) return { ok:false, reason:"nonce used" };
  if (new Date(quote.expiry) < new Date()) return { ok:false, reason:"quote expired" };

  // EVM USDC di Base
  const amountWei = BigInt(Math.round(parseFloat(quote.price) * (10 ** quote.decimals)));
  const chk = await verifyEvmErc20Transfer({
    txHash: tx,
    expectedTo: quote.pay_to.toLowerCase(),
    expectedToken: quote.token.toLowerCase(),
    expectedAmountWei: amountWei,
    expectedPayer: payer
  });
  if (!chk.ok) return { ok:false, reason: chk.reason || "verify failed" };

  // Tandai used & catat receipt
  await q("update quotes set used=true where nonce=$1", [nonce]);
  const id = ulid();
  await q(
    "insert into receipts(id, nonce, chain, tx_hash, payer, amount, verified) values($1,$2,$3,$4,$5,$6,$7)",
    [id, nonce, "base", tx, chk.payer || payer || null, (Number(amountWei) / (10 ** quote.decimals)), true]
  );
  return { ok:true };
}

function ulid(){ return crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2); }

// ============== ADMIN (opsional) ==========
app.get("/admin/receipts", async (_req, res) => {
  const { rows } = await q("select * from receipts order by created_at desc limit 100", []);
  res.json(rows);
});

app.listen(CONFIG.PORT, () => console.log(`tnemyap listening on :${CONFIG.PORT}`));
