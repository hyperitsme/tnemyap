import "dotenv/config";

export const CONFIG = {
  PORT: process.env.PORT || 8080,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  RPC_URL_BASE: process.env.RPC_URL_BASE || "https://mainnet.base.org",
  EVM: {
    TOKEN: (process.env.EVM_TOKEN_ADDRESS_USDC || "").toLowerCase(),
    DECIMALS: parseInt(process.env.EVM_TOKEN_DECIMALS || "6", 10),
    SYMBOL: process.env.EVM_TOKEN_SYMBOL || "USDC",
    MERCHANT: (process.env.MERCHANT_EVM || "").toLowerCase(),
  },
  SERVER_SECRET: process.env.SERVER_SECRET || "change-me",
  QUOTE_TTL_SEC: parseInt(process.env.QUOTE_TTL_SEC || "180", 10),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "*").split(",").map(s=>s.trim())
};
