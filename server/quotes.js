import { amount, D, quantize, id, fail, hash, lockUser } from "./core.js";
import { createOrder, validateOrder } from "./finance.js";
export function calculateQuote(body, catalog) {
  const { m: market, q: quantity, p: price } = validateOrder(body, catalog);
  const subtotal = quantize(quantity.mul(price)),
    fee = quantize(subtotal.mul("0.001"));
  if (subtotal.lt(5)) fail(400, "BELOW_MINIMUM");
  return {
    symbol: market.symbol,
    asset: market.asset,
    side: body.side,
    type: body.type,
    quantity: quantity.toFixed(18),
    price: price.toFixed(18),
    subtotal: subtotal.toFixed(18),
    fee: fee.toFixed(18),
    total: (body.side === "BUY"
      ? subtotal.plus(fee)
      : subtotal.minus(fee)
    ).toFixed(18),
    reserve: (body.side === "BUY" ? subtotal.plus(fee) : quantity).toFixed(18),
    reserveAsset: body.side === "BUY" ? "USDT" : market.asset,
    mode: "local-simulation",
  };
}
export async function saveQuote(db, user, body, catalog, key = id()) {
  const fingerprint = hash(
    JSON.stringify({
      symbol: body.symbol,
      side: body.side,
      type: body.type,
      quantity: amount(body.quantity).toString(),
      price: body.type === "LIMIT" ? amount(body.price).toString() : null,
    }),
  );
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const old = (
      await tx.query(
        "SELECT * FROM order_quotes WHERE user_id=$1 AND request_key=$2",
        [user, key],
      )
    ).rows[0];
    if (old) {
      if (old.request_hash !== fingerprint) fail(409, "IDEMPOTENCY_CONFLICT");
      return { id: old.id, ...old.payload, expires_at: old.expires_at };
    }
    const quote = calculateQuote(body, catalog),
      qid = id();
    const result = await tx.query(
      "INSERT INTO order_quotes(id,user_id,request_key,request_hash,payload,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '30 seconds') RETURNING expires_at",
      [qid, user, key, fingerprint, JSON.stringify(quote)],
    );
    return { id: qid, ...quote, expires_at: result.rows[0].expires_at };
  });
}
export async function acceptQuote(db, user, qid, catalog) {
  const row = (
    await db.query("SELECT * FROM order_quotes WHERE id=$1 AND user_id=$2", [
      qid,
      user,
    ])
  ).rows[0];
  if (!row) fail(404, "QUOTE_NOT_FOUND");
  const key = "quote-" + qid;
  const existing = (
    await db.query("SELECT * FROM orders WHERE user_id=$1 AND request_key=$2", [
      user,
      key,
    ])
  ).rows[0];
  if (existing) return existing;
  if (new Date(row.expires_at).getTime() <= Date.now())
    fail(409, "QUOTE_EXPIRED");
  const q = row.payload,
    market = catalog.find((m) => m.symbol === q.symbol && m.supported);
  if (!market) fail(400, "UNSUPPORTED_PAIR");
  if (q.type === "MARKET" && !new D(market.price).eq(q.price))
    fail(409, "QUOTE_CHANGED");
  return createOrder(db, user, q, key, catalog);
}
