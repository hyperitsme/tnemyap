export async function x402Fetch(url, opts = {}) {
  // attempt 1
  let res = await fetch(url, opts);
  if (res.status !== 402) return res;

  // ambil header quote
  const q = {
    price: res.headers.get("X-402-Price"),
    chain: res.headers.get("X-402-Chain"),
    tokenSymbol: res.headers.get("X-402-Token"),
    tokenAddress: res.headers.get("X-402-TokenAddress"),
    decimals: parseInt(res.headers.get("X-402-Decimals")||"6",10),
    to: res.headers.get("X-402-Address"),
    nonce: res.headers.get("X-402-Nonce"),
    expiry: res.headers.get("X-402-Expiry")
  };

  // bayar via MetaMask (ERC-20 transfer)
  const txHash = await payWithMetaMaskErc20(q);

  // retry dengan proof
  const headers = new Headers(opts.headers || {});
  headers.set("X-402-Proof", `tx=${txHash}; nonce=${q.nonce}`);
  const res2 = await fetch(url, { ...opts, headers });
  return res2;
}

async function payWithMetaMaskErc20(q) {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const [account] = await ethereum.request({ method: "eth_requestAccounts" });

  // Pastikan chain Base
  const baseHex = "0x2105";
  const chainId = await ethereum.request({ method:"eth_chainId" });
  if (chainId !== baseHex) {
    await ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId: baseHex }]});
  }

  const amountFloat = parseFloat(q.price.split(" ")[0] || "0");
  const amount = BigInt(Math.round(amountFloat * (10 ** q.decimals)));

  // transfer(to, amount)
  const data = encodeTransfer(q.to, amount.toString());
  const tx = await ethereum.request({
    method:"eth_sendTransaction",
    params:[{ from: account, to: q.tokenAddress, data }]
  });
  // optional: tunggu 1 konfirmasi
  return tx;
}

// Minimal encoder "transfer" 0xa9059cbb
function encodeTransfer(to, amountDec) {
  const sig = "0xa9059cbb";
  const to32 = to.replace(/^0x/,"").padStart(64,"0");
  const amtHex = BigInt(amountDec).toString(16).padStart(64,"0");
  return sig + to32 + amtHex;
}
