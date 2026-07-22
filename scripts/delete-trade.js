/**
 * delete-trade.js
 * Finds and deletes: NIFTY 21550 CE | BUY | QTY 65 | NFO
 * Searches both trades collection and admin config (settings).
 */

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

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

async function run() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("Connected to MongoDB\n");

  const db = client.db(DB_NAME);

  // 1. Search trades collection
  const trades = db.collection("trades");
  const tradeQuery = {
    symbol: { $regex: /21550/i },
    exchange: "NFO",
    side: "BUY",
    qty: 65,
  };

  const matching = await trades.find(tradeQuery).toArray();
  console.log(`Trades collection — found ${matching.length} match(es):`);
  matching.forEach((t) =>
    console.log(`  _id=${t._id} | userId=${t.userId} | symbol=${t.symbol} | price=${t.price}`)
  );

  if (matching.length > 0) {
    const result = await trades.deleteMany(tradeQuery);
    console.log(`  Deleted ${result.deletedCount} trade(s).\n`);
  } else {
    console.log("  Nothing deleted from trades.\n");
  }

  // 2. Search admin config (settings collection)
  const settings = db.collection("settings");
  const configDocs = await settings.find({ key: "dashboard_orders" }).toArray();

  console.log(`Settings collection — checking ${configDocs.length} dashboard_orders doc(s)...`);
  let totalRemoved = 0;

  for (const doc of configDocs) {
    const orders = doc.value?.orders;
    if (!Array.isArray(orders)) continue;

    const toRemove = orders.filter((r) => {
      const sym = (r.symbol || "").toUpperCase();
      return (
        sym.includes("21550") &&
        (r.exchange || "").toUpperCase() === "NFO" &&
        (r.side || "").toUpperCase() === "BUY" &&
        Number(r.qty) === 65
      );
    });

    if (toRemove.length === 0) continue;

    const updated = orders.filter((r) => !toRemove.includes(r));
    await settings.updateOne(
      { _id: doc._id },
      { $set: { "value.orders": updated, updatedAt: new Date() } }
    );

    const scope = doc.userId ? `userId:${doc.userId}` : "global";
    console.log(`  [${scope}] Removed ${toRemove.length} config row(s):`);
    toRemove.forEach((r) =>
      console.log(`    symbol=${r.symbol} | qty=${r.qty} | avgPrice=${r.avgPrice} | status=${r.status}`)
    );
    totalRemoved += toRemove.length;
  }

  if (totalRemoved === 0) {
    console.log("  No matching rows in admin config.\n");
  }

  console.log(`\nDone. Trades deleted: ${matching.length}, Config rows removed: ${totalRemoved}`);
  await client.close();
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
