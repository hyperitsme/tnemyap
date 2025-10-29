// src/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// serve static frontend dari /public
app.use(express.static(path.join(__dirname, "..", "public")));

// health check sederhana (tidak akses DB)
app.get("/health", (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// contoh endpoint protected 402 (placeholder, aman untuk test UI)
app.get("/v1/alpha-signal", (req, res) => {
  // kirim 402 agar UI memunculkan modal bayar
  res.status(402).set({
    "X-402-Product": "tnemyap-alpha",
    "X-402-Amount": "1",
    "X-402-Token": "USDC",
    "X-402-Chain": "Base",
    "X-402-Nonce": "demo-" + Date.now(),
    "X-402-Expires-At": Date.now() + 3 * 60 * 1000
  }).json({ error: "payment_required" });
});

// fallback ke index.html untuk route lain
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// WAJIB: listen di PORT dan 0.0.0.0
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`tnemyap listening on http://0.0.0.0:${PORT}`);
});
