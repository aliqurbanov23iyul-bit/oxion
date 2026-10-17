import "dotenv/config";
import { database } from "../server/db.js";
import { amount, account, post, lockUser, id } from "../server/core.js";
const args = process.argv.slice(2),
  sandbox = args[0] === "--postgres-sandbox";
if (sandbox) args.shift();
if (process.env.DATABASE_URL) {
  const name = new URL(process.env.DATABASE_URL).pathname.slice(1);
  if (
    !sandbox ||
    process.env.ENABLE_BINANCE_TESTNET !== "true" ||
    process.env.TESTNET_DATABASE_ACK !== "OXION_TESTNET_ONLY" ||
    name !== "oxion_testnet"
  )
    throw Error(
      "PostgreSQL test funding requires --postgres-sandbox, database oxion_testnet, ENABLE_BINANCE_TESTNET=true and TESTNET_DATABASE_ACK=OXION_TESTNET_ONLY. Never use real balances.",
    );
}
const [email, value = "1000"] = args;
if (!email) throw Error("Usage: npm run fund:test -- email amount");
const v = amount(value),
  db = await database(
    process.env.DATABASE_URL,
    process.env.LOCAL_DATABASE_PATH,
  );
try {
  const u = (
    await db.query("SELECT id FROM users WHERE email=$1", [
      email.trim().toLowerCase(),
    ])
  ).rows[0];
  if (!u) throw Error("Account not found. Register first.");
  await db.transaction(async (tx) => {
    await lockUser(tx, u.id);
    const a = await account(tx, u.id, "USDT", "available"),
      b = await account(tx, null, "USDT", "clearing");
    await post(tx, {
      reference: "test-funding:" + id(),
      kind: "test_funding",
      reason: "LOCAL SIMULATION ONLY; no crypto deposit or backing",
      lines: [
        { account: a, amount: v },
        { account: b, amount: v.neg() },
      ],
    });
  });
  console.log(
    "LOCAL TEST FUNDS ONLY: " +
      v.toString() +
      " simulated USDT. No real assets were deposited.",
  );
} finally {
  await db.close();
}
