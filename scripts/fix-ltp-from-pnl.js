/**
 * fix-ltp-from-pnl.js
 *
 * Fixes admin-configured order rows where ltp === avgPrice (buy = sell, looks wrong).
 * Derives the correct sell price (ltp) from the known P&L:
 *
 *   P&L = (ltp - avgPrice) × qty
 *   => ltp = avgPrice + (pnl / qty)
 *
 * Run:  node scripts/fix-ltp-from-pnl.js
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

// Parse .env manually (no dotenv dep needed)
const envPath = path.join(__dirname, "../.env");
fs.readFileSync(envPath, "utf8")
  .split("\n")
  .forEach((line) => {
    const clean = line.trim();
    if (!clean || clean.startsWith("#")) return;
    const eq = clean.indexOf("=");
    if (eq < 0) return;
    const k = clean.slice(0, eq).trim();
    const v = clean.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  });

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || "marketpulse";

if (!MONGO_URI) {
  console.error("MONGO_URI not set in .env");
  process.exit(1);
}

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("Connected to MongoDB");

  const db = client.db(DB_NAME);
  const settings = db.collection("settings");

  // Find all dashboard_orders documents (global + per-user)
  const docs = await settings
    .find({ key: "dashboard_orders" })
    .toArray();

  console.log(`Found ${docs.length} dashboard_orders document(s)\n`);

  let totalFixed = 0;

  for (const doc of docs) {
    const scope = doc.userId ? `user:${doc.userId}` : "global";
    const orders = doc.value?.orders;

    if (!Array.isArray(orders) || orders.length === 0) {
      console.log(`[${scope}] no orders, skipping`);
      continue;
    }

    let changed = false;
    const updatedOrders = orders.map((row) => {
      const avgPrice = Number(row.avgPrice || 0);
      const ltp = Number(row.ltp || 0);
      const pnl = Number(row.pnl || 0);
      const qty = Number(row.qty || 0);

      const ltpSameAsAvg = Math.abs(ltp - avgPrice) < 0.001;
      const ltpMissing = ltp === 0;

      // Only fix rows where ltp is missing or equals avgPrice AND pnl is non-zero
      if ((ltpMissing || ltpSameAsAvg) && pnl !== 0 && qty > 0 && avgPrice > 0) {
        const correctedLtp = avgPrice + pnl / qty;

        console.log(
          `[${scope}] ${row.symbol || "?"} | avgPrice=${avgPrice} | pnl=${pnl} | qty=${qty}` +
          ` | ltp was ${ltp} → corrected to ${correctedLtp.toFixed(2)}`
        );

        changed = true;
        totalFixed++;
        return { ...row, ltp: Number(correctedLtp.toFixed(2)) };
      }

      return row;
    });

    if (changed) {
      await settings.updateOne(
        { _id: doc._id },
        {
          $set: {
            "value.orders": updatedOrders,
            updatedAt: new Date(),
          },
        }
      );
      console.log(`[${scope}] saved\n`);
    } else {
      console.log(`[${scope}] nothing to fix\n`);
    }
  }

  console.log(`\nDone. Fixed ${totalFixed} row(s).`);
  await client.close();
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
