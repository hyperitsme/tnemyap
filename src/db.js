import pg from "pg";
import { CONFIG } from "./config.js";

export const pool = new pg.Pool({ connectionString: CONFIG.DATABASE_URL });

export async function q(text, params) {
  const res = await pool.query(text, params);
  return res;
}
