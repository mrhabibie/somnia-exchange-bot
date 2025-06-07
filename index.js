import "dotenv/config";
import figlet from "figlet";
import { ethers } from "ethers";
import { Twisters } from "twisters";
import fs from "fs/promises";

const RPC_URL = process.env.RPC_URL_SOMNIA_TESTNET;
let PRIVATE_KEY = null;
const USDTG_ADDRESS = process.env.USDTG_ADDRESS;
const NIA_ADDRESS = process.env.NIA_ADDRESS;
const RAND_STT_AMOUNT = process.env.RAND_STT_AMOUNT;
const RAND_USDTG_AMOUNT = process.env.RAND_USDTG_AMOUNT;
const RAND_NIA_AMOUNT = process.env.RAND_NIA_AMOUNT;
const LOOP_COUNT = process.env.LOOP_COUNT;
const ROUTER_ADDRESS = "0xb98c15a0dC1e271132e341250703c7e94c059e8D";
const WSTT_ADDRESS = "0xf22ef0085f6511f70b01a68f360dcc56261f768a";
const NETWORK_NAME = "Somnia Testnet";

const ERC20ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) public payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) public returns (uint256[])",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
];

const globalHeaders = {
  accept: "application/json",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  "content-type": "application/json",
  origin: "https://somnia.exchange",
  pragma: "no-cache",
  priority: "u=1, i",
  referer: "https://somnia.exchange/",
  "sec-ch-ua": '"Chromium";v="134", "Not:A-Brand";v="24", "Opera";v="119"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
};

let walletInfo = {
  info: "0 of 0",
  address: "",
  balanceStt: "0.00",
  balanceUsdtg: "0.00",
  balanceNia: "0.00",
  points: 0,
  rank: 0,
  network: NETWORK_NAME,
  status: "Initializing",
};

let swapCancelled = false;
let globalWallet = null;
let provider = null;
let lastSwapDirectionSttUsdtg = "USDTG_TO_STT";
let lastSwapDirectionSttNia = "NIA_TO_STT";

const twisters = new Twisters();

const displayBanner = () => {
  console.log(
    figlet.textSync("Bocil Airdrop".toUpperCase(), {
      font: "4Max",
      width: 80,
      whitespaceBreak: true,
    })
  );
  console.log();
  console.log("Join Channel: https://t.me/bocil_airdrop");
  console.log();
  console.log("Somnia Exchange Bot running...");
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getShortAddress(address) {
  return address ? address.slice(0, 6) + "..." + address.slice(-4) : "N/A";
}

function addLog(message, type = "info") {
  let text = "";
  if (type === "info") {
    text = `└── Status        : ${message}
——————————————————————————————————————————`;
  } else {
    text = `├── Status        : ${message}`;
  }
  twisters.put("b", {
    active: false,
    text,
  });
}

function getRandomDelay() {
  return Math.random() * (60000 - 30000) + 30000;
}

function getRandomNumber(min, max, decimals = 4) {
  const random = Math.random() * (max - min) + min;
  return parseFloat(random.toFixed(decimals));
}

function msToTime(milliseconds) {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const remainingMillisecondsAfterHours = milliseconds % (1000 * 60 * 60);
  const minutes = Math.floor(remainingMillisecondsAfterHours / (1000 * 60));
  const remainingMillisecondsAfterMinutes =
    remainingMillisecondsAfterHours % (1000 * 60);
  const seconds = Math.round(remainingMillisecondsAfterMinutes / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}

async function getTokenBalance(tokenAddress) {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    const balance = await contract.balanceOf(globalWallet.address);
    const decimals = await contract.decimals();
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    addLog(`Gagal mengambil saldo token ${tokenAddress}: ${error.message}`);
    return "0";
  }
}

async function updateWalletData() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    globalWallet = wallet;
    walletInfo.address = wallet.address;

    const sttBalance = await provider.getBalance(wallet.address);
    walletInfo.balanceStt = ethers.formatEther(sttBalance);

    walletInfo.balanceUsdtg = await getTokenBalance(USDTG_ADDRESS);
    walletInfo.balanceNia = await getTokenBalance(NIA_ADDRESS);

    const apiUrl = `https://api-node.somnia.exchange/api/leaderboard?wallet=${wallet.address}`;
    const response = await fetch(apiUrl, { headers: globalHeaders });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.currentUser) {
        walletInfo.points = data.currentUser.points;
        walletInfo.rank = data.currentUser.rank;
      } else {
        walletInfo.points = 0;
        walletInfo.rank = 0;
      }
    } else {
      addLog(`Gagal mengambil data leaderboard: ${response.statusText}`);
      walletInfo.points = 0;
      walletInfo.rank = 0;
    }

    updateWallet();
    addLog("Informasi wallet diperbarui!");
  } catch (error) {
    addLog(`Gagal mengambil data wallet: ${error.message}`);
  }
}

function updateWallet() {
  const shortAddress = walletInfo.address
    ? getShortAddress(walletInfo.address)
    : "N/A";
  const stt = walletInfo.balanceStt
    ? Number(walletInfo.balanceStt).toFixed(4)
    : "0.0000";
  const usdtg = walletInfo.balanceUsdtg
    ? Number(walletInfo.balanceUsdtg).toFixed(2)
    : "0.00";
  const nia = walletInfo.balanceNia
    ? Number(walletInfo.balanceNia).toFixed(4)
    : "0.0000";
  const points = walletInfo.points;
  const rank = walletInfo.rank;

  const text = `
————————————————— ${walletInfo.info} —————————————————
┌── Address       : ${shortAddress}
│   ├── STT       : ${stt}
│   ├── USDT.g    : ${usdtg}
│   ├── NIA       : ${nia}
│   ├── Points    : ${points}
│   ├── Rank      : ${rank}
├── Network       : ${NETWORK_NAME}
│`;
  twisters.put("a", {
    text,
  });
}

async function approveToken(tokenAddress, amountIn) {
  try {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20ABI,
      globalWallet
    );
    const allowance = await tokenContract.allowance(
      globalWallet.address,
      ROUTER_ADDRESS
    );
    const decimals = await tokenContract.decimals();
    const amount = ethers.parseUnits(amountIn.toString(), decimals);

    if (allowance < amount) {
      addLog(`Meng-approve ${amountIn} token ${tokenAddress} untuk router...`);
      const approvalTx = await executeSwapWithNonceRetry(async (nonce) => {
        return await tokenContract.approve(ROUTER_ADDRESS, ethers.MaxUint256, {
          nonce,
        });
      }, true);
      await approvalTx.wait();
      addLog(`Token ${tokenAddress} berhasil di-approve.`);
    }
    return true;
  } catch (error) {
    addLog(`Gagal approve token ${tokenAddress}: ${error.message}`);
    return false;
  }
}

async function getAmountOut(amountIn, path) {
  try {
    const routerContract = new ethers.Contract(
      ROUTER_ADDRESS,
      ROUTER_ABI,
      provider
    );
    const amounts = await routerContract.getAmountsOut(amountIn, path);
    return amounts[amounts.length - 1];
  } catch (error) {
    addLog(`Gagal menghitung amountOut: ${error.message}`);
    return ethers.parseEther("0");
  }
}

async function requestFaucet() {
  try {
    const response = await fetch("https://testnet.somnia.network/api/faucet", {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        Priority: "u=1, i",
        "Sec-Ch-Ua":
          '"Not)A;Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ address: globalWallet.address }),
    });
    const data = await response.json();
    if (response.ok && data?.success) {
      addLog("Faucet claimed successfully.");
      return true;
    } else {
      addLog(`Claim faucet failed: ${data.details || response.statusText}`);
      return false;
    }
  } catch (error) {
    addLog(`Unable to claim faucet: ${error.message}`);
    return false;
  }
}

async function reportTransaction() {
  try {
    const payload = {
      address: globalWallet.address,
      taskId: "make-swap",
    };
    const response = await fetch(
      "https://api.somnia.exchange/api/completeTask",
      {
        method: "POST",
        headers: globalHeaders,
        body: JSON.stringify(payload),
      }
    );
    const data = await response.json();
    if (response.ok && data.success) {
      addLog(
        `Report transaction berhasil: +${data.data.task.actualPointsAwarded} Points`
      );
      return true;
    } else {
      addLog(`Gagal report transaction: ${data.error || response.statusText}`);
      return false;
    }
  } catch (error) {
    addLog(`Gagal report transaction: ${error.message}`);
    return false;
  }
}

async function executeSwapWithNonceRetry(
  txFn,
  returnTx = false,
  maxRetries = 3
) {
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const pendingNonce = await provider.getTransactionCount(
        globalWallet.address,
        "pending"
      );
      const latestNonce = await provider.getTransactionCount(
        globalWallet.address,
        "latest"
      );
      const nonce = pendingNonce > latestNonce ? pendingNonce : latestNonce;
      const tx = await txFn(nonce);
      if (returnTx) return tx;
      const receipt = await tx.wait();
      if (receipt.status === 1) {
        return receipt;
      } else {
        throw new Error("Transaksi reverted");
      }
    } catch (error) {
      if (
        error.message.includes("nonce too low") ||
        error.message.includes("nonce has already been used") ||
        error.message.includes("reverted")
      ) {
        addLog(
          `Transaksi gagal (percobaan ${retry + 1}): ${
            error.message
          }. Mengambil nonce terbaru...`
        );
        if (retry === maxRetries - 1) {
          throw new Error(
            `Gagal setelah ${maxRetries} percobaan: ${error.message}`
          );
        }
        continue;
      } else {
        throw error;
      }
    }
  }
}

async function autoSwapSttUsdtg() {
  try {
    const routerContract = new ethers.Contract(
      ROUTER_ADDRESS,
      ROUTER_ABI,
      globalWallet
    );
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const sttBalance = parseFloat(walletInfo.balanceStt);
    const usdtgBalance = parseFloat(walletInfo.balanceUsdtg);
    const minSttAmount = Number(RAND_STT_AMOUNT.split(",")[0].trim());
    const maxSttAmount = Number(RAND_STT_AMOUNT.split(",")[1].trim());
    const minUsdtgAmount = Number(RAND_USDTG_AMOUNT.split(",")[0].trim());
    const maxUsdtgAmount = Number(RAND_USDTG_AMOUNT.split(",")[1].trim());
    const sttAmount = getRandomNumber(minSttAmount, maxSttAmount, 4);
    const usdtgAmount = getRandomNumber(minUsdtgAmount, maxUsdtgAmount, 4);

    let receipt;

    if (lastSwapDirectionSttUsdtg === "USDTG_TO_STT") {
      if (sttBalance < sttAmount) {
        addLog(`Saldo STT tidak cukup: ${sttBalance} < ${sttAmount}`);
        await delay(3000);
        return false;
      }

      const amountIn = ethers.parseEther(sttAmount.toString());
      const path = [WSTT_ADDRESS, USDTG_ADDRESS];
      const amountOutMin = await getAmountOut(amountIn, path);
      const slippage = (amountOutMin * BigInt(95)) / BigInt(100);

      addLog(`Melakukan swap ${sttAmount} STT ➯ USDT.g`);

      receipt = await executeSwapWithNonceRetry(async (nonce) => {
        return await routerContract.swapExactETHForTokens(
          slippage,
          path,
          globalWallet.address,
          deadline,
          { value: amountIn, gasLimit: 300000, nonce }
        );
      });

      if (receipt.status === 1) {
        addLog(`Swap berhasil. Hash: ${receipt.hash}`);
        await delay(3000);
        await reportTransaction();
        lastSwapDirectionSttUsdtg = "STT_TO_USDTG";
        return true;
      }
    } else {
      if (usdtgBalance < usdtgAmount) {
        addLog(`Saldo USDT.g tidak cukup: ${usdtgBalance} < ${usdtgAmount}`);
        await delay(3000);
        return false;
      }

      const tokenContract = new ethers.Contract(
        USDTG_ADDRESS,
        ERC20ABI,
        globalWallet
      );
      const decimals = await tokenContract.decimals();
      const amountIn = ethers.parseUnits(usdtgAmount.toString(), decimals);
      const path = [USDTG_ADDRESS, WSTT_ADDRESS];
      const amountOutMin = await getAmountOut(amountIn, path);
      const slippage = (amountOutMin * BigInt(95)) / BigInt(100);

      const approved = await approveToken(USDTG_ADDRESS, usdtgAmount);
      if (!approved) return false;

      addLog(`Melakukan swap ${usdtgAmount} USDT.g ➯ STT`);

      receipt = await executeSwapWithNonceRetry(async (nonce) => {
        return await routerContract.swapExactTokensForETH(
          amountIn,
          slippage,
          path,
          globalWallet.address,
          deadline,
          { gasLimit: 300000, nonce }
        );
      });

      if (receipt.status === 1) {
        addLog(`Swap berhasil. Hash: ${receipt.hash}`);
        await delay(3000);
        await reportTransaction();
        lastSwapDirectionSttUsdtg = "USDTG_TO_STT";
        return true;
      }
    }
    return false;
  } catch (error) {
    addLog(`Gagal melakukan swap: ${error.message}`);
    return false;
  }
}

async function autoSwapSttNia() {
  try {
    const routerContract = new ethers.Contract(
      ROUTER_ADDRESS,
      ROUTER_ABI,
      globalWallet
    );
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const sttBalance = parseFloat(walletInfo.balanceStt);
    const niaBalance = parseFloat(walletInfo.balanceNia);
    const minSttAmount = Number(RAND_STT_AMOUNT.split(",")[0].trim());
    const maxSttAmount = Number(RAND_STT_AMOUNT.split(",")[1].trim());
    const minNiaAmount = Number(RAND_NIA_AMOUNT.split(",")[0].trim());
    const maxNiaAmount = Number(RAND_NIA_AMOUNT.split(",")[1].trim());
    const sttAmount = getRandomNumber(minSttAmount, maxSttAmount, 4);
    const niaAmount = getRandomNumber(minNiaAmount, maxNiaAmount, 4);

    let receipt;

    if (lastSwapDirectionSttNia === "NIA_TO_STT") {
      if (sttBalance < sttAmount) {
        addLog(`Saldo STT tidak cukup: ${sttBalance} < ${sttAmount}`);
        await delay(3000);
        return false;
      }

      const amountIn = ethers.parseEther(sttAmount.toString());
      const path = [WSTT_ADDRESS, NIA_ADDRESS];
      const amountOutMin = await getAmountOut(amountIn, path);
      const slippage = (amountOutMin * BigInt(95)) / BigInt(100);

      addLog(`Melakukan swap ${sttAmount} STT ➯ NIA`);

      receipt = await executeSwapWithNonceRetry(async (nonce) => {
        return await routerContract.swapExactETHForTokens(
          slippage,
          path,
          globalWallet.address,
          deadline,
          { value: amountIn, gasLimit: 300000, nonce }
        );
      });

      if (receipt.status === 1) {
        addLog(`Swap berhasil. Hash: ${receipt.hash}`);
        await delay(3000);
        await reportTransaction();
        lastSwapDirectionSttNia = "STT_TO_NIA";
        return true;
      }
    } else {
      if (niaBalance < niaAmount) {
        addLog(`Saldo NIA tidak cukup: ${niaBalance} < ${niaAmount}`);
        await delay(3000);
        return false;
      }

      const tokenContract = new ethers.Contract(
        NIA_ADDRESS,
        ERC20ABI,
        globalWallet
      );
      const decimals = await tokenContract.decimals();
      const amountIn = ethers.parseUnits(niaAmount.toString(), decimals);
      const path = [NIA_ADDRESS, WSTT_ADDRESS];
      const amountOutMin = await getAmountOut(amountIn, path);
      const slippage = (amountOutMin * BigInt(95)) / BigInt(100);

      const approved = await approveToken(NIA_ADDRESS, niaAmount);
      if (!approved) return false;

      addLog(`Melakukan swap ${niaAmount} NIA ➯ STT`);

      receipt = await executeSwapWithNonceRetry(async (nonce) => {
        return await routerContract.swapExactTokensForETH(
          amountIn,
          slippage,
          path,
          globalWallet.address,
          deadline,
          { gasLimit: 300000, nonce }
        );
      });

      if (receipt.status === 1) {
        addLog(`Swap berhasil. Hash: ${receipt.hash}`);
        await delay(3000);
        await reportTransaction();
        lastSwapDirectionSttNia = "NIA_TO_STT";
        return true;
      }
    }
    return false;
  } catch (error) {
    addLog(`Gagal melakukan swap: ${error.message}`);
    return false;
  }
}

async function runAutoSwap(pair, autoSwapFunction, lastSwapDirection) {
  addLog(`Mulai ${LOOP_COUNT} iterasi swap untuk ${pair}.`);
  await delay(3000);

  swapCancelled = false;

  for (let i = 1; i <= LOOP_COUNT; i++) {
    if (swapCancelled) {
      addLog(`Auto swap ${pair} dihentikan pada cycle ${i}.`);
      break;
    }
    addLog(`Memulai swap ke-${i} untuk ${pair}`);
    await delay(3000);
    await autoSwapFunction();
    await updateWalletData();
    await delay(3000);
    if (i < LOOP_COUNT && !swapCancelled) {
      addLog(`Swap ke-${i} selesai.`, "swap");
      for (let ms = getRandomDelay(); ms > 0; ms -= 1000) {
        twisters.put("c", {
          active: false,
          text: `└── Info          : Delaying for ${msToTime(ms)}
——————————————————————————————————————————`,
        });
        await delay(1000);
      }
      twisters.remove("c");
    }
  }
  swapCancelled = false;
  addLog(`Auto swap untuk ${pair} selesai.`, "swap");
  await delay(3000);
}

async function main() {
  const keys = (await fs.readFile("keys.txt", "utf-8"))
    .replace(/\r/g, "")
    .split("\n")
    .filter(Boolean);

  displayBanner();

  while (true) {
    const nextRunAt = Date.now() + 24 * 60 * 60 * 1000;

    for (let walletIndex = 0; walletIndex < keys.length; walletIndex++) {
      PRIVATE_KEY = keys[walletIndex];
      walletInfo.info = `${walletIndex + 1} of ${keys.length}`;
      lastSwapDirectionSttUsdtg = "USDTG_TO_STT";
      lastSwapDirectionSttNia = "NIA_TO_STT";

      await updateWalletData();
      await delay(3000);

      const faucetClaimed = await requestFaucet();
      if (faucetClaimed) {
        await delay(3000);
        await updateWalletData();
        await delay(3000);
      }

      await runAutoSwap(
        "STT & USDT.g",
        autoSwapSttUsdtg,
        lastSwapDirectionSttUsdtg
      );

      await runAutoSwap("STT & NIA", autoSwapSttNia, lastSwapDirectionSttNia);

      if (walletIndex < keys.length) {
        addLog("Prepare to next account...", "swap");
        for (let ms = getRandomDelay(); ms > 0; ms -= 1000) {
          twisters.put("c", {
            active: false,
            text: `└── Info          : Delaying for ${msToTime(ms)}
——————————————————————————————————————————`,
          });
          await delay(1000);
        }
      }
    }

    addLog("Cooling down...", "swap");

    const lastRunAt = Date.now();
    for (let ms = nextRunAt - lastRunAt; ms > 0; ms -= 1000) {
      twisters.put("c", {
        active: false,
        text: `└── Info          : Delaying for ${msToTime(ms)}
——————————————————————————————————————————`,
      });
      await delay(1000);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
