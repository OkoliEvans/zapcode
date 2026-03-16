import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { privy, privyNode } from "../lib/privy.js";
import { db } from "../db/index.js";
import { merchants } from "../db/schema.js";
import { sendWelcome } from "../services/email.js";
import { generateQRPng, buildQRPayload } from "../services/qr.js";
import { convert } from "../services/rates.js";
import { sendStrk, MERCHANT_PREFUND } from "./wallet.js";

const router = Router();

// Create or fetch Starknet wallet via privyNode — must match signing client
async function getOrCreateStarknetWallet(privyUserId) {
  const user = await privy.getUser(privyUserId);
  const existing = user.linkedAccounts?.find(
    (a) => a.type === "wallet" && a.chainType === "starknet",
  );

  if (existing) {
    // Fetch publicKey via walletApi — only reliable source
    const details = await privy.walletApi.getWallet({ id: existing.id });
    return {
      id: details.id,
      address: details.address,
      publicKey: details.publicKey ?? "",
    };
  }

  // Create via privyNode so rawSign also works via privyNode
  const wallet = await privyNode.wallets().create({ chain_type: "starknet" });
  const publicKey = wallet.public_key ?? wallet.publicKey ?? "";

  if (!publicKey) {
    const details = await privy.walletApi.getWallet({ id: wallet.id });
    return {
      id: wallet.id,
      address: wallet.address,
      publicKey: details.publicKey ?? "",
    };
  }

  return { id: wallet.id, address: wallet.address, publicKey };
}

router.get("/me", requireAuth, async (req, res) => {
  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.id, req.userId))
    .limit(1);
  if (!merchant) return res.status(404).json({ error: "Not onboarded yet" });
  const fx = await convert(1, merchant.currency).catch(() => null);
  res.json({ ...merchant, fx });
});

router.post("/onboard", requireAuth, async (req, res) => {
  const [existing] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.id, req.userId))
    .limit(1);
  if (existing) return res.status(409).json({ error: "Already onboarded" });

  const {
    businessName,
    currency = "USD",
    country = "KE",
    network = "mainnet",
  } = req.body;
  if (!businessName)
    return res.status(400).json({ error: "businessName is required" });

  try {
    const privyUser = await privy.getUser(req.userId);
    const email =
      privyUser.email?.address ??
      privyUser.google?.email ??
      privyUser.linkedAccounts?.find((a) => a.type === "email")?.address;

    if (!email)
      return res.status(400).json({ error: "No email found on Privy account" });

    const wallet = await getOrCreateStarknetWallet(req.userId);

    if (!wallet.publicKey)
      throw new Error("Could not retrieve wallet publicKey from Privy");

    const [merchant] = await db
      .insert(merchants)
      .values({
        id: req.userId,
        email,
        businessName,
        walletId: wallet.id,
        walletAddress: wallet.address,
        publicKey: wallet.publicKey,
        currency: currency.toUpperCase(),
        country: country.toUpperCase(),
        network,
      })
      .returning();

    // Prefund merchant with 0.15 STRK to cover account deployment
    // Fire-and-forget — non-fatal if it fails
    sendStrk(wallet.address, MERCHANT_PREFUND, "merchant");

    sendWelcome(merchant).catch((e) =>
      console.error("[merchants] welcome email:", e.message),
    );
    res.status(201).json(merchant);
  } catch (err) {
    console.error("[merchants] onboard error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me", requireAuth, async (req, res) => {
  const allowed = ["businessName", "currency", "country", "logoUrl"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length)
    return res.status(400).json({ error: "No valid fields to update" });
  updates.updatedAt = new Date();
  const [updated] = await db
    .update(merchants)
    .set(updates)
    .where(eq(merchants.id, req.userId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Merchant not found" });
  res.json(updated);
});

router.get("/:id", async (req, res) => {
  const raw = req.params.id;
  const padded = raw.startsWith("0x")
    ? "0x" + raw.slice(2).padStart(64, "0")
    : raw;
  const [merchant] = await db
    .select({
      id: merchants.id,
      businessName: merchants.businessName,
      walletAddress: merchants.walletAddress,
      currency: merchants.currency,
      network: merchants.network,
      logoUrl: merchants.logoUrl,
    })
    .from(merchants)
    .where(
      or(eq(merchants.walletAddress, raw), eq(merchants.walletAddress, padded)),
    )
    .limit(1);
  if (!merchant) return res.status(404).json({ error: "Merchant not found" });
  const fx = await convert(1, merchant.currency).catch(() => null);
  res.json({ ...merchant, fx });
});

router.get("/:id/qr.png", async (req, res) => {
  const raw = req.params.id;
  const padded = raw.startsWith("0x")
    ? "0x" + raw.slice(2).padStart(64, "0")
    : raw;
  const [merchant] = await db
    .select({
      id: merchants.id,
      businessName: merchants.businessName,
      walletAddress: merchants.walletAddress,
      network: merchants.network,
      logoUrl: merchants.logoUrl,
    })
    .from(merchants)
    .where(
      or(eq(merchants.walletAddress, raw), eq(merchants.walletAddress, padded)),
    )
    .limit(1);
  if (!merchant) return res.status(404).json({ error: "Merchant not found" });
  try {
    const payload = buildQRPayload(
      merchant.walletAddress,
      merchant.network,
      merchant.id,
    );
    const png = await generateQRPng(payload, {
      businessName: merchant.businessName,
      logoUrl: merchant.logoUrl,
    });
    res.set({
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${merchant.businessName.replace(/\s+/g, "-")}-zapcode.png"`,
      "Cache-Control": "no-cache",
    });
    res.send(png);
  } catch (err) {
    console.error("[merchants] QR error:", err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

export default router;
