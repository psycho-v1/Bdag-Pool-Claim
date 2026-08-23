/**
 * Shared app helpers for BDAG Pool Claim
 * Chain 1404 · Flexible RPC (type / paste any endpoint)
 */
const APP = (() => {
  const CHAIN_ID = 1404n;
  const CHAIN_HEX = "0x57c";

  // Sensible defaults (used only if the user has never set an RPC)
  const DEFAULT_RPCS = [
    "https://rpc.east.bdag-us.org",
    "https://rpc.west.bdag-us.org",
    "https://rpc.welshdag.trade",
    "https://rpc.kenny-us-pool.com"
  ];

  const DEFAULT_EXPLORERS = [
    "https://explorer.east.bdag-us.org",
    "https://scan.welshdag.trade"
  ];

  const STORAGE_VAULT = "bdag_vault";
  const STORAGE_RPC   = "bdag_custom_rpc";

  let provider = null;
  let signer   = null;
  let account  = null;

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

  // ----- Flexible RPC -----
  function getRpc() {
    const saved = (localStorage.getItem(STORAGE_RPC) || "").trim();
    if (saved) return saved;
    return DEFAULT_RPCS[0];
  }

  function setRpc(url) {
    url = (url || "").trim();
    if (!url) {
      localStorage.removeItem(STORAGE_RPC);
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("RPC must start with http:// or https://");
    }
    localStorage.setItem(STORAGE_RPC, url);
  }

  function getRpcListForWallet() {
    const preferred = getRpc();
    const list = [preferred, ...DEFAULT_RPCS.filter(r => r !== preferred)];
    return list;
  }

  // Better wallet detection
  function getEthereum() {
    if (typeof window === "undefined") return null;
    if (window.ethereum?.providers) {
      const mm = window.ethereum.providers.find(p => p.isMetaMask);
      if (mm) return mm;
    }
    if (window.ethereum?.isMetaMask) return window.ethereum;
    if (window.ethereum) return window.ethereum;
    return null;
  }

  async function ensureChain() {
    const eth = getEthereum();
    if (!eth) throw new Error("No wallet found");

    let net = await provider.getNetwork();
    if (net.chainId === CHAIN_ID) return;

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_HEX }]
      });
    } catch (e) {
      if (e.code === 4902 || (e.message && e.message.includes("Unrecognized"))) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CHAIN_HEX,
            chainName: "BlockDAG Mainnet",
            nativeCurrency: { name: "BDAG", symbol: "BDAG", decimals: 18 },
            rpcUrls: getRpcListForWallet(),
            blockExplorerUrls: DEFAULT_EXPLORERS
          }]
        });
      } else {
        throw e;
      }
    }

    provider = new ethers.BrowserProvider(eth);
    net = await provider.getNetwork();
    if (net.chainId !== CHAIN_ID) {
      throw new Error("Please switch MetaMask to BlockDAG (chain 1404)");
    }
  }

  async function connect() {
    const eth = getEthereum();
    if (!eth) {
      throw new Error(
        "MetaMask not detected. Use Chrome/Brave, unlock MetaMask, and disable other wallet extensions."
      );
    }

    provider = new ethers.BrowserProvider(eth);
    await provider.send("eth_requestAccounts", []);
    await ensureChain();
    signer  = await provider.getSigner();
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
      const eth = getEthereum();
      if (eth) {
        provider = new ethers.BrowserProvider(eth);
      } else {
        provider = new ethers.JsonRpcProvider(getRpc());
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
    const latest  = await provider.getTransactionCount(account, "latest");
    const pending = await provider.getTransactionCount(account, "pending");
    return pending - latest;
  }

  // Optional RPC input UI helper
  // Add this HTML anywhere:
  // <input id="rpcInput" placeholder="https://rpc.…" />
  // <button id="btnSaveRpc" type="button">Save RPC</button>
  function initRpcInput() {
    const input = $("rpcInput");
    const btn   = $("btnSaveRpc");
    if (!input) return;

    input.value = getRpc();

    if (btn) {
      btn.addEventListener("click", () => {
        try {
          setRpc(input.value);
          log("RPC saved: " + getRpc(), "ok");
          provider = null;
        } catch (e) {
          log(e.message || String(e), "err");
        }
      });
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (btn) btn.click();
      }
    });
  }

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

    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-links a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("/").pop();
      if (href === path) a.classList.add("active");
    });

    const vp = $("vaultPill");
    if (vp) {
      const v = getVault();
      vp.textContent = v ? short(v) : "No vault";
    }

    const btn = $("btnConnect");
    if (btn) {
      btn.addEventListener("click", () => {
        connect().catch((e) => log(e.shortMessage || e.message || String(e), "err"));
      });
    }

    const eth = getEthereum();
    if (eth) {
      eth.request({ method: "eth_accounts" }).then(async (accs) => {
        if (accs && accs.length) {
          try { await connect(); } catch (_) {}
        }
      }).catch(() => {});
    }

    initRpcInput();
  }

  return {
    CHAIN_ID,
    DEFAULT_RPCS,
    DEFAULT_EXPLORERS,
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
    getRpc,
    setRpc,
    initNav,
    get provider() { return provider; },
    get signer() { return signer; },
    get account() { return account; }
  };
})();

document.addEventListener("DOMContentLoaded", () => APP.initNav());
