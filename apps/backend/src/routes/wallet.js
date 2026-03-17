import { Router } from "express";
import { eq } from "drizzle-orm";
import { RpcProvider, Account, cairo, CallData } from "starknet";
import { requireAuth } from "../middleware/auth.js";
import { privyNode } from "../lib/privy.js";
import { db } from "../db/index.js";
import { merchants, buyers } from "../db/schema.js";

const router = Router();

const IS_MAINNET = process.env.STARKNET_NETWORK === "mainnet";

const AVNU_PAYMASTER_URL = IS_MAINNET
  ? "https://starknet.paymaster.avnu.fi"
  : "https://sepolia.paymaster.avnu.fi";

const AVNU_DEPLOY_URL = IS_MAINNET
  ? "https://starknet.paymaster.avnu.fi/deploy"
  : "https://sepolia.paymaster.avnu.fi/deploy";

const AVNU_API_KEY = process.env.AVNU_API_KEY ?? "";
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS ?? "";
const TREASURY_PRIV_KEY = process.env.TREASURY_PRIVATE_KEY ?? "";
const STARKNET_RPC_URL = process.env.STARKNET_RPC_URL ?? "";

const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// 0.001 STRK for buyers — covers deploy gas
const BUYER_PREFUND = BigInt("400000000000000000");
// 0.15 STRK for merchants
const MERCHANT_PREFUND = BigInt("400000000000000000");

const avnuHeaders = {
  "Content-Type": "application/json",
  ...(AVNU_API_KEY ? { "x-paymaster-api-key": AVNU_API_KEY } : {}),
};

// ── Treasury STRK transfer — awaits confirmation before resolving ──────────
async function sendStrk(toAddress, amount, label = "") {
  if (!TREASURY_ADDRESS || !TREASURY_PRIV_KEY) {
    console.warn("[treasury] env vars not set — skipping prefund");
    return;
  }

  const provider = new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
  const treasury = new Account({
    provider,
    address: TREASURY_ADDRESS,
    signer: TREASURY_PRIV_KEY,
  });

  const result = await treasury.execute({
    contractAddress: STRK_ADDRESS,
    entrypoint: "transfer",
    calldata: CallData.compile({
      recipient: toAddress,
      amount: cairo.uint256(amount),
    }),
  });

  console.log(
    `[treasury] ${label} sent to ${toAddress} — tx: ${result.transaction_hash}`,
  );

  await provider.waitForTransaction(result.transaction_hash, {
    retryInterval: 2000,
  });

  console.log(`[treasury] ${label} confirmed — ${toAddress} funded`);
}

// ── POST /api/wallet/starknet ──────────────────────────────────────────────
router.post("/starknet", requireAuth, async (req, res) => {
  try {
    // 1. Merchant — return from DB
    const [merchant] = await db
      .select({
        walletId: merchants.walletId,
        walletAddress: merchants.walletAddress,
        publicKey: merchants.publicKey,
      })
      .from(merchants)
      .where(eq(merchants.id, req.userId))
      .limit(1);

    if (merchant) {
      return res.json({
        wallet: {
          id: merchant.walletId,
          address: merchant.walletAddress,
          publicKey: merchant.publicKey,
        },
      });
    }

    // 2. Existing buyer — return from DB
    const [existingBuyer] = await db
      .select({
        walletId: buyers.walletId,
        walletAddress: buyers.walletAddress,
        publicKey: buyers.publicKey,
      })
      .from(buyers)
      .where(eq(buyers.id, req.userId))
      .limit(1);

    if (existingBuyer) {
      return res.json({
        wallet: {
          id: existingBuyer.walletId,
          address: existingBuyer.walletAddress,
          publicKey: existingBuyer.publicKey,
        },
      });
    }

    // 3. New buyer — create wallet, await STRK prefund, store in DB
    const wallet = await privyNode.wallets().create({ chain_type: "starknet" });
    const publicKey = wallet.public_key ?? wallet.publicKey ?? "";
    const network = IS_MAINNET ? "mainnet" : "sepolia";

    // Await confirmation — STRK must land before we return so deploy succeeds
    await sendStrk(wallet.address, BUYER_PREFUND, "buyer");

    await db
      .insert(buyers)
      .values({
        id: req.userId,
        walletId: wallet.id,
        walletAddress: wallet.address,
        publicKey,
        network,
      })
      .onConflictDoNothing();

    // Re-fetch to get winning row in case of concurrent insert race
    const [inserted] = await db
      .select({
        walletId: buyers.walletId,
        walletAddress: buyers.walletAddress,
        publicKey: buyers.publicKey,
      })
      .from(buyers)
      .where(eq(buyers.id, req.userId))
      .limit(1);

    res.json({
      wallet: {
        id: inserted?.walletId ?? wallet.id,
        address: inserted?.walletAddress ?? wallet.address,
        publicKey: inserted?.publicKey ?? publicKey,
      },
    });
  } catch (err) {
    console.error("[wallet/starknet]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/wallet/sign ──────────────────────────────────────────────────
router.post("/sign", async (req, res) => {
  const { walletId, hash } = req.body;
  if (!walletId || !hash)
    return res.status(400).json({ error: "walletId and hash are required" });
  try {
    const result = await privyNode
      .wallets()
      .rawSign(walletId, { params: { hash } });
    res.json({ signature: result.signature });
  } catch (err) {
    console.error("[wallet/sign]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/wallet/paymaster ─────────────────────────────────────────────
router.post("/paymaster", async (req, res) => {
  try {
    const response = await fetch(AVNU_PAYMASTER_URL, {
      method: "POST",
      headers: avnuHeaders,
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[paymaster]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/wallet/paymaster/deploy ─────────────────────────────────────
router.post("/paymaster/deploy", async (req, res) => {
  try {
    const response = await fetch(AVNU_DEPLOY_URL, {
      method: "POST",
      headers: avnuHeaders,
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("[paymaster/deploy]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/wallet/upload-logo ──────────────────────────────────────────
router.post("/upload-logo", requireAuth, async (req, res) => {
  const IMGBB_KEY = process.env.IMGBB_API_KEY;
  if (!IMGBB_KEY)
    return res.status(500).json({ error: "IMGBB_API_KEY not configured" });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: "image is required" });

  try {
    const form = new URLSearchParams();
    form.append("key", IMGBB_KEY);
    form.append("image", image);

    const response = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form,
    });
    const data = await response.json();
    if (!data.success)
      throw new Error(data.error?.message ?? "imgbb upload failed");
    res.json({ url: data.data.display_url });
  } catch (err) {
    console.error("[upload-logo]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export { sendStrk, MERCHANT_PREFUND };
export default router;
