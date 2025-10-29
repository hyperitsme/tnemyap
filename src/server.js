import path from "node:path";
import express from "express";
import cors from "cors";
import { RateLimiterRedis } from "rate-limiter-flexible";

import { CONFIG } from "./config.js";
import { redis } from "./redis.js";
import { q } from "./db.js";
import { priceFor } from "./priceEngine.js";
import { makeQuote, parseProofHeader, settleReceipt } from "./x402.js";
import { verifyEvmErc20Transfer } from "./verifier/evm.js";

const app = express();
app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (CONFIG.CORS_ORIGINS.includes("*") || !origin) return cb(null, true);
    cb(null, CONFIG.CORS_ORIGINS.includes(origin));
  }
}));

// Serve static frontend
app.use("/", express.static(path.join(process.cwd(), "public")));

// Rate limiting by IP
const limiter = new RateLimiterRedis({
  storeClient: redis, keyPrefix: "rl", points: 120, duration: 60
});
app.use(async (req, res, next) => {
  try { await limiter.consume(req.ip); next(); }
  catch { res.status(429).json({ error: "Too Many Requests" }); }
});

// Health
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Example protected resource
app.get("/v1/alpha-signal", x402Gate, async (_req, res) => {
  res.json({ pair: "BTC-USD", timeframe: "1h", signal: "BULLISH", confidence: 0.73, ts: new Date().toISOString() });
});

// Admin
app.get("/admin/receipts", async (_req, res) => {
  const { rows } = await q("select * from receipts order by created_at desc limit 100", []);
  res.json(rows);
});

/** 402 middleware */
async function x402Gate(req, res, next) {
  const proof = req.get("X-402-Proof");
  if (proof) {
    const ok = await verifyProof(proof);
    if (!ok.ok) return res.status(402).json({ error: "Invalid X-402 proof", reason: ok.reason });
    return next();
  }

  // No proof -> return 402 with quote
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

async function verifyProof(proofHeader) {
  const { tx, payer, nonce } = parseProofHeader(proofHeader);
  if (!tx || !nonce) return { ok: false, reason: "missing tx/nonce" };

  const { rows } = await q("select * from quotes where nonce=$1", [nonce]);
  const quote = rows[0];
  if (!quote) return { ok: false, reason: "nonce not found" };
  if (quote.used) return { ok: false, reason: "nonce used" };
  if (new Date(quote.expiry) < new Date()) return { ok: false, reason: "quote expired" };

  const amountWei = BigInt(Math.round(parseFloat(quote.price) * (10 ** quote.decimals)));
  const chk = await verifyEvmErc20Transfer({
    txHash: tx,
    expectedTo: quote.pay_to.toLowerCase(),
    expectedToken: quote.token.toLowerCase(),
    expectedAmountWei: amountWei,
    expectedPayer: payer
  });
  if (!chk.ok) return { ok: false, reason: chk.reason || "verify failed" };

  await settleReceipt({
    nonce,
    chain: "base",
    txHash: tx,
    payer: chk.payer || payer,
    amountWei,
    decimals: quote.decimals
  });

  return { ok: true };
}

app.listen(CONFIG.PORT, () => {
  console.log(`tnemyap listening on :${CONFIG.PORT}`);
});
