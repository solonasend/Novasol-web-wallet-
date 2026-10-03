let currentPubkey = null;
let connection = null;
let tokenList = [];

const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const TOKEN_2022_PROGRAM_ID = new solanaWeb3.PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

function initConnection() {
  const networkSelect = document.getElementById("network-select");
  const network = networkSelect ? networkSelect.value : "devnet";

  let rpcUrl;

  if (network === "mainnet-beta") {
    rpcUrl = "https://api.mainnet-beta.solana.com";
  } else if (network === "testnet") {
    rpcUrl = "https://api.testnet.solana.com";
  } else {
    rpcUrl = "https://api.devnet.solana.com";
  }

  connection = new solanaWeb3.Connection(rpcUrl, "confirmed");
  updateNetworkBadge(network);
}

function updateNetworkBadge(network) {
  const badge = document.getElementById("net-badge");
  if (!badge) return;

  if (network === "mainnet-beta") {
    badge.innerText = "MAINNET";
    badge.className = "text-xs font-semibold text-green-400";
  } else if (network === "testnet") {
    badge.innerText = "TESTNET";
    badge.className = "text-xs font-semibold text-orange-400";
  } else {
    badge.innerText = "DEVNET";
    badge.className = "text-xs font-semibold text-yellow-400";
  }
}

function switchNetwork() {
  initConnection();
  if (currentPubkey) refreshAll();
}

function loadDashboard() {
  const input = document.getElementById("input-address");
  if (!input) return;

  const address = input.value.trim();

  if (!address) {
    alert("Enter a Solana public address.");
    return;
  }

  try {
    currentPubkey = new solanaWeb3.PublicKey(address);

    document.getElementById("dashboard").classList.remove("hidden");
    document.getElementById("active-pubkey").innerText = currentPubkey.toBase58();
    document.getElementById("modal-pubkey").innerText = currentPubkey.toBase58();

    refreshAll();
  } catch (error) {
    console.error(error);
    alert("Invalid Solana Public Address.");
  }
}

async function refreshAll() {
  if (!currentPubkey || !connection) return;

  await fetchBalance();
  await fetchSPLTokens();
  updateTokenSelector();
}

async function fetchBalance() {
  if (!currentPubkey || !connection) return;

  try {
    const lamports = await connection.getBalance(currentPubkey);
    const sol = lamports / solanaWeb3.LAMPORTS_PER_SOL;
    const value = sol.toFixed(4);

    const balance = document.getElementById("sol-balance");
    const tokenValue = document.getElementById("token-sol-val");

    if (balance) balance.innerText = value;
    if (tokenValue) tokenValue.innerText = `${value} SOL`;
  } catch (error) {
    console.error("SOL balance error:", error);
  }
}

async function fetchSPLTokens() {
  if (!currentPubkey || !connection) return;

  const list = document.getElementById("spl-token-list");
  if (!list) return;

  list.innerHTML = "Loading SPL tokens...";

  try {
    const classic = await connection.getParsedTokenAccountsByOwner(
      currentPubkey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const token2022 = await connection.getParsedTokenAccountsByOwner(
      currentPubkey,
      { programId: TOKEN_2022_PROGRAM_ID }
    );

    const accounts = [...classic.value, ...token2022.value];
    tokenList = [];

    for (const item of accounts) {
      const info = item.account.data.parsed.info;
      const tokenAmount = info.tokenAmount;
      const amount = Number(tokenAmount.uiAmount || 0);

      if (amount <= 0) continue;

      tokenList.push({
        account: item.pubkey,
        mint: new solanaWeb3.PublicKey(info.mint),
        amount,
        decimals: tokenAmount.decimals,
        programId: item.account.owner
      });
    }

    renderTokenList();
  } catch (error) {
    console.error("SPL token error:", error);
    list.innerHTML = "Unable to load SPL tokens.";
  }
}

function renderTokenList() {
  const list = document.getElementById("spl-token-list");
  if (!list) return;

  if (!tokenList.length) {
    list.innerHTML = "No other SPL tokens found";
    return;
  }

  list.innerHTML = "";

  tokenList.forEach((token, index) => {
    const row = document.createElement("div");
    row.className =
      "bg-gray-900/60 p-3 rounded-xl flex justify-between items-center border border-gray-800";

    row.innerHTML = `
      <div class="min-w-0">
        <p class="text-sm font-medium">SPL Token ${index + 1}</p>
        <p class="text-[10px] text-gray-500 truncate max-w-[220px]">${token.mint.toBase58()}</p>
      </div>
      <p class="text-sm font-semibold ml-2">${token.amount}</p>
    `;

    list.appendChild(row);
  });
}

function detectWallet() {
  if (window.coinbaseSolana) {
    return window.coinbaseSolana;
  }

  if (window.phantom && window.phantom.solana) {
    return window.phantom.solana;
  }

  if (window.backpack) {
    return window.backpack;
  }

  if (window.solana) {
    return window.solana;
  }

  return null;
}

function getSigningWallet() {
  const provider = detectWallet();

  if (!provider) {
    throw new Error("Solana wallet extension not found.");
  }

  if (!provider.publicKey) {
    throw new Error(
      "Wallet public key is not available. Open your Coinbase Wallet extension and make sure the Solana wallet is active."
    );
  }

  return provider;
}

function verifySender(provider) {
  if (!currentPubkey) {
    throw new Error("Import a Solana public address first.");
  }

  if (!provider.publicKey) {
    throw new Error("Wallet public key is unavailable.");
  }

  const imported = currentPubkey.toBase58();
  const wallet = provider.publicKey.toBase58();

  if (imported !== wallet) {
    throw new Error(
      "Imported public address and wallet address do not match."
    );
  }
}

function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.toggle("hidden", !show);

  if (show && id === "send-modal") {
    updateTokenSelector();
  }
}

async function copyAddress() {
  const element = document.getElementById("modal-pubkey");
  if (!element) return;

  const address = element.innerText;

  if (!address || address === "--") return;

  try {
    await navigator.clipboard.writeText(address);
    alert("Address copied to clipboard!");
  } catch (error) {
    console.error(error);
    alert("Unable to copy address.");
  }
}

function updateTokenSelector() {
  const selector = document.getElementById("asset-selector");
  if (!selector) return;

  selector.innerHTML = "";

  const solOption = document.createElement("option");
  solOption.value = "SOL";
  solOption.innerText = "SOL";
  selector.appendChild(solOption);

  tokenList.forEach((token, index) => {
    const option = document.createElement("option");
    option.value = `SPL:${index}`;
    option.innerText = `SPL Token ${index + 1} — ${token.amount}`;
    selector.appendChild(option);
  });

  updateAmountLabel();
}

function updateAmountLabel() {
  const selector = document.getElementById("asset-selector");
  const label = document.getElementById("amount-label");
  const title = document.getElementById("send-title");

  if (!selector || !label) return;

  if (selector.value === "SOL") {
    label.innerText = "Amount (SOL)";
    if (title) title.innerText = "📤 Send SOL";
  } else {
    label.innerText = "Amount (Token)";
    if (title) title.innerText = "📤 Send SPL Token";
  }
}

async function executeTransaction() {
  const status = document.getElementById("tx-status");
  const receiverInput = document.getElementById("send-to");
  const amountInput = document.getElementById("send-amount");
  const selector = document.getElementById("asset-selector");

  if (!status) return;

  const recipient = receiverInput.value.trim();
  const amount = Number(amountInput.value);

  if (!recipient) {
    status.innerText = "Enter receiver address.";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    status.innerText = "Enter a valid amount.";
    return;
  }

  let receiver;

  try {
    receiver = new solanaWeb3.PublicKey(recipient);
  } catch (error) {
    status.innerText = "Invalid receiver address.";
    return;
  }

  try {
    const provider = getSigningWallet();
    verifySender(provider);

    if (!selector || selector.value === "SOL") {
      const transaction = new solanaWeb3.Transaction();

      const lamports = Math.round(
        amount * solanaWeb3.LAMPORTS_PER_SOL
      );

      if (lamports <= 0) {
        throw new Error("Amount is too small.");
      }

      transaction.add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey: provider.publicKey,
          toPubkey: receiver,
          lamports
        })
      );

      transaction.feePayer = provider.publicKey;

      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = latest.blockhash;

      status.innerText =
        "Approve the transaction in Coinbase Wallet...";

      const signed = await provider.signTransaction(transaction);

      status.innerText = "Sending signed transaction...";

      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false }
      );

      status.innerText = "Waiting for confirmation...";

      await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight
        },
        "confirmed"
      );

      status.innerText = `Success: ${signature.slice(0, 12)}...`;

      await fetchBalance();
      return;
    }

    if (selector.value.startsWith("SPL:")) {
      const index = Number(selector.value.split(":")[1]);
      const token = tokenList[index];

      if (!token) {
        throw new Error("Selected token not found.");
      }

      const tokenProgramId = token.programId.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const rawAmount = BigInt(
        Math.round(amount * Math.pow(10, token.decimals))
      );

      if (rawAmount <= 0n) {
        throw new Error("Amount is too small.");
      }

      const sourceTokenAccount = token.account;

      const destinationTokenAccount =
        solanaSplToken.getAssociatedTokenAddressSync(
          token.mint,
          receiver,
          false,
          tokenProgramId,
          solanaSplToken.ASSOCIATED_TOKEN_PROGRAM_ID
        );

      const transaction = new solanaWeb3.Transaction();

      const destinationInfo = await connection.getAccountInfo(
        destinationTokenAccount
      );

      if (!destinationInfo) {
        transaction.add(
          solanaSplToken.createAssociatedTokenAccountInstruction(
            provider.publicKey,
            destinationTokenAccount,
            receiver,
            token.mint,
            tokenProgramId,
            solanaSplToken.ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      transaction.add(
        solanaSplToken.createTransferCheckedInstruction(
          sourceTokenAccount,
          token.mint,
          destinationTokenAccount,
          provider.publicKey,
          rawAmount,
          token.decimals,
          [],
          tokenProgramId
        )
      );

      transaction.feePayer = provider.publicKey;

      const latest = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = latest.blockhash;

      status.innerText =
        "Approve the token transaction in Coinbase Wallet...";

      const signed = await provider.signTransaction(transaction);

      status.innerText = "Sending signed token transaction...";

      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false }
      );

      status.innerText = "Waiting for confirmation...";

      await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight
        },
        "confirmed"
      );

      status.innerText = `Success: ${signature.slice(0, 12)}...`;

      await fetchBalance();
      await fetchSPLTokens();
      updateTokenSelector();
    }
  } catch (error) {
    console.error("Transaction error:", error);

    const message = error?.message || "";

    if (
      error?.code === 4001 ||
      /reject|denied|cancel/i.test(message)
    ) {
      status.innerText = "Transaction cancelled.";
    } else {
      status.innerText = message || "Transaction failed.";
    }
  }
}

initConnection();
