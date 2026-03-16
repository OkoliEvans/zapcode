import { uint256 } from "starknet";
import {
  provider,
  USDC_ADDRESS,
  USDCE_ADDRESS,
  TRANSFER_SELECTOR,
} from "../lib/starknet.js";
import { db } from "../db/index.js";
import { merchants, transactions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { sendPaymentReceived } from "./email.js";
import { convert } from "./rates.js";

let lastCheckedBlock = null;

function normalizeAddr(addr) {
  if (!addr) return "";
  return "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

async function getActiveMerchantAddresses() {
  const rows = await db
    .select({ walletAddress: merchants.walletAddress, id: merchants.id })
    .from(merchants)
    .where(eq(merchants.isActive, true));
  return rows;
}

function parseTransferEvent(event) {
  try {
    const keys = event.keys;
    const data = event.data;
    let from, to, amountLow, amountHigh;

    if (keys.length >= 3) {
      // OZ ERC20: keys=[selector, from, to], data=[amount_low, amount_high]
      from = keys[1];
      to = keys[2];
      amountLow = data[0];
      amountHigh = data[1];
    } else {
      // StarkGate/USDC.e: keys=[selector], data=[from, to, amount_low, amount_high]
      from = data[0];
      to = data[1];
      amountLow = data[2];
      amountHigh = data[3];
    }

    const amount = uint256.uint256ToBN({ low: amountLow, high: amountHigh });
    return { from, to, amount: (Number(amount) / 1_000_000).toFixed(6) };
  } catch {
    return null;
  }
}

async function processContract(
  contractAddress,
  currency,
  fromBlock,
  toBlock,
  addressSet,
) {
  let continuationToken = undefined;
  try {
    do {
      const result = await provider.getEvents({
        address: contractAddress,
        keys: [[TRANSFER_SELECTOR]],
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        chunk_size: 100,
        continuation_token: continuationToken,
      });

      for (const event of result.events) {
        const parsed = parseTransferEvent(event);
        if (!parsed) continue;

        const toAddr = normalizeAddr(parsed.to);
        const merchantId = addressSet.get(toAddr);
        if (!merchantId) continue;

        const txHash = event.transaction_hash;

        const existing = await db
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.txHash, txHash))
          .limit(1);
        if (existing.length > 0) continue;

        const tx = await db
          .insert(transactions)
          .values({
            id: uuid(),
            merchantId,
            txHash,
            fromAddress: parsed.from,
            toAddress: parsed.to,
            amount: parsed.amount,
            currency,
            status: "confirmed",
            blockNumber: String(event.block_number ?? toBlock),
            confirmedAt: new Date(),
          })
          .returning();

        const newTx = tx[0];
        console.log(
          `[watcher] 💰 ${parsed.amount} ${currency} → merchant ${merchantId} | tx ${txHash.slice(0, 16)}…`,
        );

        const [merchant] = await db
          .select()
          .from(merchants)
          .where(eq(merchants.id, merchantId))
          .limit(1);

        if (merchant && !newTx.emailSent) {
          const fxResult = await convert(
            parsed.amount,
            merchant.currency,
          ).catch(() => null);
          sendPaymentReceived(merchant, newTx, fxResult)
            .then(() =>
              db
                .update(transactions)
                .set({ emailSent: true })
                .where(eq(transactions.id, newTx.id)),
            )
            .catch((err) =>
              console.error("[watcher] email error:", err.message),
            );
        }
      }

      continuationToken = result.continuation_token;
    } while (continuationToken);
  } catch (err) {
    console.error(`[watcher] ${currency} error:`, err.message);
    throw err;
  }
}

export async function pollOnce() {
  try {
    const latestBlock = await provider.getBlockNumber();

    if (lastCheckedBlock === null) {
      lastCheckedBlock = latestBlock;
      console.log(`[watcher] starting from block ${latestBlock}`);
      return;
    }

    if (latestBlock <= lastCheckedBlock) return;

    const fromBlock = lastCheckedBlock + 1;
    const toBlock = latestBlock;

    const activeMerchants = await getActiveMerchantAddresses();
    if (activeMerchants.length === 0) {
      lastCheckedBlock = latestBlock;
      return;
    }

    const addressSet = new Map(
      activeMerchants.map((m) => [normalizeAddr(m.walletAddress), m.id]),
    );

    await processContract(USDC_ADDRESS, "USDC", fromBlock, toBlock, addressSet);
    if (USDCE_ADDRESS) {
      await processContract(
        USDCE_ADDRESS,
        "USDC.e",
        fromBlock,
        toBlock,
        addressSet,
      );
    }

    lastCheckedBlock = latestBlock;
  } catch (err) {
    console.error("[watcher] poll error:", err.message);
  }
}
