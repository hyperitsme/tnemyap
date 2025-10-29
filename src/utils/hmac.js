import crypto from "crypto";
import { CONFIG } from "../config.js";

export function hmacBase64(payload) {
  return crypto.createHmac("sha256", CONFIG.SERVER_SECRET)
    .update(payload)
    .digest("base64");
}
