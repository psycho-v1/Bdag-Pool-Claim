/**
 * Shared app helpers for BDAG Pool Claim
 * Chain 1404 · Engineering RPC only
 */
const APP = (() => {
  const CHAIN_ID = 1404n;
  const CHAIN_HEX = "0x57c";
  const COMMUNITY_RPCS = ["https://rpc.blockdag.engineering"];
  const EXPLORERS = ["https://explorer.blockdag.engineering"];
  const STORAGE_VAULT = "bdag_vault";

  let provider = null;
  let signer = null;
  let account = null;

  function $(id) { return document.getElementById(id); }

  function log(msg, cls) {
    const box = $("log");
    if (!box) return;
    const d = document.createElement("div");
    if (cls) d.className = cls;
    d.textContent = msg;
    box.appendChild(d);
    box.scrollTop = 1e9;
  }

  function clearLog() {
    const box = $("log");
    if (box) box.innerHTML = "";
  }

  function getVault() {
    return (localStorage.getItem(STORAGE_VAULT) || "").trim();
  }

  function setVault(addr) {
    if (addr) localStorage.setItem(STORAGE_VAULT, addr);
    else localStorage.removeItem(STORAGE_VAULT);
    const el = $("vaultPill");
    if (el) el.textContent = addr ? short(addr) : "No vault";
  }

  function short(a) {
    if (!a || a.length < 12) return a || "—";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  async function ensureChain() {
    let net = await provider.getNetwork();
    if (net.chainId === CHAIN_ID) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_HEX }]
      });
    } catch (e) {
      if (e.code === 4902 || (e.message && e.message.includes("Unrecognized"))) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CHAIN_HEX,
            chainName: "BlockDAG Mainnet",
            nativeCurrency: { name: "BDAG", symbol: "BDAG", decimals: 18 },
            rpcUrls: COMMUNITY_RPCS,
            blockExplorerUrls: EXPLORERS
          }]
        });
      } else {
        throw e;
      }
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    net = await provider.getNetwork();
    if (net.chainId !== CHAIN_ID) throw new Error("Switch wallet to BlockDAG chain 1404");
  }

  async function connect() {
    if (!window.ethereum) throw new Error("Install MetaMask (Chrome / Brave)");
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    await ensureChain();
    signer = await provider.getSigner();
    account = await signer.getAddress();
    updateWalletUI();
    log("Connected " + account, "ok");
    return account;
  }

  function updateWalletUI() {
    const wp = $("walletPill");
    const cp = $("chainPill");
    if (wp) {
      wp.textContent = account ? short(account) : "Not connected";
      wp.className = "pill " + (account ? "ok" : "");
    }
    if (cp) {
      cp.textContent = account ? "Chain 1404" : "—";
      cp.className = "pill " + (account ? "ok" : "");
    }
    const btn = $("btnConnect");
    if (btn) btn.textContent = account ? "Connected" : "Connect wallet";
  }

  async function getVaultContract(withSigner) {
    const addr = getVault();
    if (!addr) throw new Error("No vault selected — open Fund or Manage and paste vault address");
    if (!window.VAULT_ABI) throw new Error("VAULT_ABI missing — load embed.js");
    if (withSigner) {
      if (!signer) await connect();
      return new ethers.Contract(ethers.getAddress(addr), window.VAULT_ABI, signer);
    }
    if (!provider) {
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
      } else {
        provider = new ethers.JsonRpcProvider(COMMUNITY_RPCS[0]);
      }
    }
    return new ethers.Contract(ethers.getAddress(addr), window.VAULT_ABI, provider);
  }

  async function refreshVaultBalance(targetId) {
    try {
      const c = await getVaultContract(false);
      const bal = await c.vaultBalance();
      const el = $(targetId || "vaultBal");
      if (el) el.textContent = Number(ethers.formatEther(bal)).toFixed(4) + " BDAG";
      return bal;
    } catch (e) {
      const el = $(targetId || "vaultBal");
      if (el) el.textContent = "—";
      throw e;
    }
  }

  async function checkNonceGap() {
    if (!account || !provider) return 0;
    const latest = await provider.getTransactionCount(account, "latest");
    const pending = await provider.getTransactionCount(account, "pending");
    return pending - latest;
  }

  // Nav dropdown toggle
  function initNav() {
    document.querySelectorAll(".nav-drop > button").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const parent = btn.parentElement;
        document.querySelectorAll(".nav-drop").forEach((d) => {
          if (d !== parent) d.classList.remove("open");
        });
        parent.classList.toggle("open");
      });
    });
    document.addEventListener("click", () => {
      document.querySelectorAll(".nav-drop").forEach((d) => d.classList.remove("open"));
    });

    // Mark active link
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("/").pop();
      if (href === path) a.classList.add("active");
    });

    // Prefill vault pill
    const vp = $("vaultPill");
    if (vp) {
      const v = getVault();
      vp.textContent = v ? short(v) : "No vault";
    }

    // Connect button
    const btn = $("btnConnect");
    if (btn) {
      btn.addEventListener("click", () => {
        connect().catch((e) => log(e.shortMessage || e.message || String(e), "err"));
      });
    }

    // Auto-connect if already authorized
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(async (accs) => {
        if (accs && accs.length) {
          try { await connect(); } catch (_) {}
        }
      }).catch(() => {});
    }
  }

  return {
    CHAIN_ID,
    COMMUNITY_RPCS,
    EXPLORERS,
    $,
    log,
    clearLog,
    getVault,
    setVault,
    short,
    connect,
    ensureChain,
    getVaultContract,
    refreshVaultBalance,
    checkNonceGap,
    initNav,
    get provider() { return provider; },
    get signer() { return signer; },
    get account() { return account; }
  };
})();

document.addEventListener("DOMContentLoaded", () => APP.initNav());
