// src/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ====== KONFIGURASI USDC & RPC ======
const BASE_RPC = process.env.RPC_URL_BASE || "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(BASE_RPC);

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ERC20_IFACE = new ethers.Interface([
  "event Transfer(address indexed from,address indexed to,uint256 value)"
]);

const MERCHANT = (process.env.MERCHANT_EVM || "").toLowerCase();
if (!MERCHANT) {
  console.warn("[WARN] MERCHANT_EVM belum di-set. Set dulu di Environment agar versi REAL berjalan.");
}

// ====== PENYIMPAN SEMENTARA NONCE (bisa ganti Redis/DB) ======
const pending = new Map(); // nonce -> { to, amount6, expireMs }

// ====== STATIC FRONTEND ======
app.use(express.static(path.join(__dirname, "..", "public")));

// Favicon quick fix (hindari 502)
app.get("/favicon.ico", (_, res) => res.status(204).end());

// ====== HEALTH ======
app.get("/health", async (req, res) => {
  try {
    const bn = await provider.getBlockNumber();
    res.json({ ok: true, rpc: BASE_RPC, baseBlock: bn, ts: new Date().toISOString() });
  } catch {
    res.json({ ok: true, rpc: BASE_RPC, ts: new Date().toISOString() });
  }
});

// ====== PROTECTED: KIRIM 402 ======
app.get("/v1/alpha-signal", (req, res) => {
  // Harga contoh: 1.50 USDC
  const amountHuman = "1.50";
  const amount6 = ethers.parseUnits(amountHuman, 6).toString();
  const nonce = "nx-" + Date.now();
  const to = MERCHANT || "0x0000000000000000000000000000000000000000";
  const expMs = Date.now() + 3 * 60 * 1000; // 3 menit

  pending.set(nonce, { to: to.toLowerCase(), amount6, expireMs: expMs });

  res.status(402).set({
    "X-402-Product": "tnemyap-alpha",
    "X-402-Amount": amountHuman, // human-readable
    "X-402-Token": "USDC",
    "X-402-Chain": "Base",
    "X-402-To": to,
    "X-402-Nonce": nonce,
    "X-402-Expires-At": String(expMs)
  }).json({ error: "payment_required" });
});

// ====== REDEEM: VERIFIKASI TX & KIRIM KONTEN ======
app.get("/v1/alpha-signal/redeem", async (req, res) => {
  try {
    const { nonce, tx } = req.query;
    if (!nonce || !tx) return res.status(400).json({ error: "missing_params" });

    const expect = pending.get(nonce);
    if (!expect) return res.status(400).json({ error: "nonce_invalid" });
    if (Date.now() > expect.expireMs) {
      pending.delete(nonce);
      return res.status(400).json({ error: "expired" });
    }

    const receipt = await provider.getTransactionReceipt(tx);
    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({ error: "tx_not_confirmed" });
    }

    // Cari event Transfer USDC ke merchant dengan jumlah tepat
    let ok = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== USDC_BASE.toLowerCase()) continue;
      try {
        const parsed = ERC20_IFACE.parseLog({ topics: log.topics, data: log.data });
        if (
          parsed.name === "Transfer" &&
          parsed.args.to.toLowerCase() === expect.to &&
          parsed.args.value.toString() === expect.amount6
        ) {
          ok = true;
          break;
        }
      } catch {
        // skip non-ERC20 logs
      }
    }

    if (!ok) return res.status(400).json({ error: "transfer_mismatch" });

    // Lolos verifikasi → hapus nonce & kirim data premium
    pending.delete(nonce);

    // >>> DATA BERBAYAR <<<
    const payload = {
      signal: "BUY",
      pair: "BTC/USDT",
      timeframe: "1H",
      score: 0.78,
      issuedAt: new Date().toISOString()
    };
    return res.json(payload);
  } catch (e) {
    console.error("redeem error", e);
    return res.status(500).json({ error: "internal_error", message: e.message });
  }
});

// ====== SPA Fallback ======
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ====== START ======
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`tnemyap listening on http://0.0.0.0:${PORT}`);
});
