// Simple pricing engine per resource (customize as needed)
export async function priceFor(req) {
  const url = req.originalUrl || req.url;
  if (url.includes("/alpha-signal")) return 0.25; // 0.25 USDC/call
  return 0.05; // default
}
