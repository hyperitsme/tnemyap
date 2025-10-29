import { ethers } from "ethers";
import { CONFIG } from "../config.js";

const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL_BASE);
const iface = new ethers.Interface([
  "function transfer(address to,uint256 amount)"
]);

// Verify ERC-20 transfer(to,amount) to merchant on Base chain
export async function verifyEvmErc20Transfer({
  txHash,
  expectedTo,
  expectedToken,
  expectedAmountWei,
  expectedPayer // optional
}) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    return { ok: false, reason: "tx not mined or failed" };
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx || (tx.to?.toLowerCase() !== expectedToken)) {
    return { ok: false, reason: "not token contract call" };
  }

  let to, amount;
  try {
    [to, amount] = iface.decodeFunctionData("transfer", tx.data);
  } catch {
    return { ok: false, reason: "decode failed" };
  }

  if (to.toLowerCase() !== expectedTo) return { ok: false, reason: "wrong receiver" };
  if (amount < expectedAmountWei)      return { ok: false, reason: "insufficient amount" };
  if (expectedPayer && tx.from && expectedPayer.toLowerCase() !== tx.from.toLowerCase()) {
    return { ok: false, reason: "unexpected payer" };
  }

  return { ok: true, payer: tx.from, amountWei: amount.toString() };
}
