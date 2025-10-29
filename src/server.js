import express from "express";
import cors from "cors";
import { ulid } from "ulid";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// ------ CORS + expose 402 headers ------
const origins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: origins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Expose-Headers",
    "X-402-Amount, X-402-To, X-402-Nonce, X-402-Expires-At"
  );
  next();
});

// ------ In-memory store untuk demo (pakai Redis di produksi) ------
const pending = new Map(); // nonce -> { price, to, exp }

// ------ Health ------
app.get("/health", (req, res) => {
  res.type("text/plain").send("ok");
});

// ------ Ask: balas 402 ------
app.get("/v1/agent/ask", (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ error: "missing_query" });

  const amount = process.env.PRICE_USDC || "1.50"; // human readable
  const to = process.env.MERCHANT_EVM;
  if (!to) return res.status(500).json({ error: "merchant_not_configured" });

  const nonce = ulid();
  const expMs = Date.now() + 5 * 60 * 1000;

  // simpan
  pending.set(nonce, { price: amount, to, exp: expMs });

  res.set({
    "X-402-Amount": amount,
    "X-402-To": to,
    "X-402-Nonce": nonce,
    "X-402-Expires-At": String(expMs)
  });

  // 402 dengan payload kecil
  res.status(402).json({ error: "payment_required" });
});

// ------ Redeem: verifikasi sederhana ------
app.get("/v1/agent/redeem", async (req, res) => {
  const nonce = (req.query.nonce || "").toString();
  const tx = (req.query.tx || "").toString();

  if (!nonce || !tx) return res.status(400).json({ error: "missing_params" });

  const saved = pending.get(nonce);
  if (!saved) return res.status(404).json({ error: "nonce_not_found" });
  if (Date.now() > saved.exp) {
    pending.delete(nonce);
    return res.status(410).json({ error: "nonce_expired" });
  }

  // NOTE (demo): kita tidak memeriksa tx on-chain di sini.
  // Di produksi, cek via event Transfer USDC ke `saved.to` sesuai jumlah `saved.price`.

  // bersihkan
  pending.delete(nonce);

  // balas "jawaban agent"
  const answer = `Paid ✅ | Here is your premium result for nonce ${nonce}.`;
  res.json({ ok: true, answer, tx });
});

// ------ Start ------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`tnemyap backend listening on :${PORT}`);
});
