import { D, amount, fail, quantize } from "./core.js";
import { calculateQuote } from "./quotes.js";
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export async function sizeOrder(db, user, b, catalog) {
  const market = catalog.find((m) => m.symbol === b.symbol && m.supported);
  if (
    !market ||
    !["BUY", "SELL"].includes(b.side) ||
    !["MARKET", "LIMIT"].includes(b.type)
  )
    fail(400, "UNSUPPORTED_PAIR");
  const price = b.type === "LIMIT" ? amount(b.price) : amount(market.price);
  const asset = b.side === "BUY" ? "USDT" : market.asset;
  const available = new D(
    (
      await db.query(
        "SELECT balance FROM accounts WHERE user_id=$1 AND asset=$2 AND bucket='available'",
        [user, asset],
      )
    ).rows[0]?.balance || "0",
  );
  let q;
  if (b.percent !== undefined) {
    if (!Number.isInteger(b.percent) || b.percent < 1 || b.percent > 100)
      fail(400, "INVALID_AMOUNT");
    if (available.lte(0)) fail(409, "INSUFFICIENT_BALANCE");
    q =
      b.side === "BUY"
        ? available.mul(b.percent).div(100).div(price.mul("1.001"))
        : available.mul(b.percent).div(100);
  } else
    q = amount(b.budget).div(price.mul(b.side === "BUY" ? "1.001" : "0.999"));
  let units = 1n;
  for (const f of market.filters || []) {
    if (
      f.filterType !== "LOT_SIZE" &&
      !(f.filterType === "MARKET_LOT_SIZE" && b.type === "MARKET")
    )
      continue;
    const step = new D(f.stepSize || "0");
    if (!step.gt(0)) continue;
    if (!quantize(step).eq(step)) fail(400, "UNSUPPORTED_PAIR");
    const n = BigInt(step.toFixed(18).replace(".", ""));
    units = (units / gcd(units, n)) * n;
  }
  const step = new D(units.toString()).div("1000000000000000000");
  q = quantize(q.div(step).floor().mul(step));
  if (!q.gt(0)) fail(400, "BELOW_MINIMUM");
  const quote = calculateQuote({ ...b, quantity: q.toFixed(18) }, catalog);
  if (new D(quote.reserve).gt(available)) fail(409, "INSUFFICIENT_BALANCE");
  return { ...quote, available: available.toFixed(18) };
}
