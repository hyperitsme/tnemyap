import Redis from "ioredis";
import { CONFIG } from "./config.js";

export const redis = new Redis(CONFIG.REDIS_URL, { lazyConnect: false });
