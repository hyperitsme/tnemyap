import { ethers } from "ethers";
import { CONFIG } from "../config.js";

const providerBase = new ethers.JsonRpcProvider(CONFIG.RPC_URL_BASE);
const iface = new ethers.Interface(["function transfer(address to,uint256 amount)"]);

export async function verifyEvmErc20Transfer({ txHash, expectedTo, expectedToken, expectedAmountWei, expectedPayer }) {
  const receipt = await providerBase.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) return { ok: false, reason: "tx not mined or failed" };

  const tx = await providerBase.getTransaction(txHash);
  if (!tx || (tx.to?.toLowerCase() !== expectedToken)) return { ok: false, reason: "not token transfer" };

  let to, amount;
  try {
    [to, amount] = iface.decodeFunctionData("transfer", tx.data);
  } catch {
    return { ok: false, reason: "decode fail" };
  }

  if (to.toLowerCase() !== expectedTo) return { ok: false, reason: "wrong receiver" };
  if (expectedPayer && tx.from && expectedPayer.toLowerCase() !== tx.from.toLowerCase()) {
    return { ok: false, reason: "unexpected payer" };
  }
  if (amount < expectedAmountWei) return { ok: false, reason: "insufficient amount" };

  return { ok: true, payer: tx.from, amountWei: amount.toString() };
}
