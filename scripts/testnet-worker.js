import "dotenv/config";
import { database } from "../server/db.js";
import { BinanceTestnet } from "../server/providers.js";
import { runExecutionOnce } from "../server/execution.js";
if (
  process.env.ENABLE_BINANCE_TESTNET !== "true" ||
  !process.env.DATABASE_URL ||
  !process.env.BINANCE_TESTNET_API_KEY ||
  !process.env.BINANCE_TESTNET_API_SECRET
)
  throw Error(
    "Testnet worker requires ENABLE_BINANCE_TESTNET=true, DATABASE_URL and Binance testnet keys. Mainnet is unsupported.",
  );
const db = await database(process.env.DATABASE_URL),
  provider = new BinanceTestnet(
    process.env.BINANCE_TESTNET_API_KEY,
    process.env.BINANCE_TESTNET_API_SECRET,
  );
let busy = false,
  closing = false;
const timer = setInterval(async () => {
  if (busy || closing) return;
  busy = true;
  try {
    const result = await runExecutionOnce(db, provider);
    if (!result.idle) console.log("BINANCE TESTNET", result.state);
  } catch (e) {
    console.error("Testnet worker failed:", e.code || e.message);
  } finally {
    busy = false;
    if (closing) {
      await db.close();
      process.exit(0);
    }
  }
}, 1000);
console.log(
  "BINANCE TESTNET ONLY: durable execution worker. No mainnet endpoint exists.",
);
function shutdown() {
  closing = true;
  clearInterval(timer);
  if (!busy) db.close().then(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("data", (c) => {
  if (c.toString().trim() === "stop") shutdown();
});
