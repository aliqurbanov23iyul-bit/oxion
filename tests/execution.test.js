import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { id, D } from "../server/core.js";
import { confirmedDeposit, fillOrder } from "../server/finance.js";
import {
  queueTestnetOrder,
  runExecutionOnce,
  requestTestnetCancel,
} from "../server/execution.js";
let db;
const catalog = [
  {
    symbol: "BTCUSDT",
    asset: "BTC",
    supported: true,
    price: "100",
    filters: [],
  },
];
const body = {
  symbol: "BTCUSDT",
  side: "BUY",
  type: "LIMIT",
  quantity: "1",
  price: "100",
};
before(async () => (db = await database(null, "memory://")));
after(async () => db.close());
async function user() {
  const uid = id();
  await db.query(
    "INSERT INTO users(id,uid,email,verified) VALUES($1,$2,$3,TRUE)",
    [uid, "OX-" + id(), id() + "@example.invalid"],
  );
  await confirmedDeposit(db, {
    verified: true,
    confirmations: 12,
    requiredConfirmations: 12,
    provider: "test-fixture",
    transferId: id(),
    txid: "TEST-ONLY",
    user: uid,
    asset: "USDT",
    network: "ETH-SEPOLIA",
    amount: "1000",
  });
  return uid;
}
const balance = async (user, asset, bucket) =>
  new D(
    (
      await db.query(
        "SELECT balance FROM accounts WHERE user_id=$1 AND asset=$2 AND bucket=$3",
        [user, asset, bucket],
      )
    ).rows[0]?.balance || 0,
  ).toString();
async function ready(oid) {
  await db.query("UPDATE execution_jobs SET next_at=now() WHERE order_id=$1", [
    oid,
  ]);
}
function provider() {
  return {
    posts: 0,
    snapshot: { orderId: "42", status: "NEW", executedQty: "0" },
    fills: [],
    async order(order) {
      this.posts++;
      this.identity = {
        symbol: order.symbol,
        clientOrderId: order.id,
        side: order.side,
        type: order.type,
        origQty: order.quantity,
      };
      return this.snapshot;
    },
    async status() {
      return { ...this.identity, ...this.snapshot };
    },
    async trades() {
      return this.fills;
    },
    async cancel() {
      this.snapshot = { ...this.snapshot, status: "CANCELED" };
    },
  };
}
function trade(qty, price, commission, commissionAsset = "USDT") {
  return {
    id: id(),
    symbol: "BTCUSDT",
    orderId: "42",
    qty,
    price,
    quoteQty: new D(qty).mul(price).toString(),
    commission,
    commissionAsset,
  };
}
test("timeout reconciles the same client ID without a second POST; partial fills deduplicate", async () => {
  const uid = await user(),
    key = id(),
    o = await queueTestnetOrder(db, uid, body, key, catalog);
  assert.equal((await queueTestnetOrder(db, uid, body, key, catalog)).id, o.id);
  const p = provider();
  const submit = p.order;
  p.order = async function (order) {
    await submit.call(this, order);
    throw Error("connection lost after acceptance");
  };
  assert.equal((await runExecutionOnce(db, p)).state, "unknown");
  assert.equal(await balance(uid, "USDT", "locked"), "100.1");
  p.snapshot = {
    orderId: "42",
    status: "PARTIALLY_FILLED",
    executedQty: "0.4",
  };
  p.fills = [trade("0.4", "100", "0.04")];
  await ready(o.id);
  assert.equal((await runExecutionOnce(db, p)).state, "accepted");
  await ready(o.id);
  await runExecutionOnce(db, p);
  assert.equal(
    (await db.query("SELECT * FROM fills WHERE order_id=$1", [o.id])).rows
      .length,
    1,
  );
  p.snapshot = { orderId: "42", status: "FILLED", executedQty: "1" };
  p.fills.push(trade("0.6", "100", "0.0006", "BTC"));
  await ready(o.id);
  assert.equal((await runExecutionOnce(db, p)).status, "filled");
  assert.equal(p.posts, 1);
  assert.equal(await balance(uid, "BTC", "available"), "0.9994");
  assert.equal(await balance(uid, "USDT", "available"), "899.96");
  assert.equal(await balance(uid, "USDT", "locked"), "0");
});
test("definitive rejection releases reservation and records rejected status", async () => {
  const uid = await user(),
    o = await queueTestnetOrder(db, uid, body, id(), catalog),
    p = provider();
  p.order = async () => {
    throw Object.assign(Error("rejected"), { definitiveRejection: true });
  };
  assert.equal((await runExecutionOnce(db, p)).status, "rejected");
  assert.equal(await balance(uid, "USDT", "available"), "1000");
  assert.equal(
    (await db.query("SELECT status FROM orders WHERE id=$1", [o.id])).rows[0]
      .status,
    "rejected",
  );
});
test("a queued cancellation is never submitted to the exchange", async () => {
  const uid = await user(),
    o = await queueTestnetOrder(db, uid, body, id(), catalog),
    p = provider();
  await requestTestnetCancel(db, uid, o.id);
  assert.equal((await runExecutionOnce(db, p)).status, "cancelled");
  assert.equal(p.posts, 0);
  assert.equal(await balance(uid, "USDT", "available"), "1000");
});
test("cancellation settles confirmed partial trades before releasing the remainder", async () => {
  const uid = await user(),
    o = await queueTestnetOrder(db, uid, body, id(), catalog),
    p = provider();
  p.snapshot = {
    orderId: "42",
    status: "PARTIALLY_FILLED",
    executedQty: "0.25",
  };
  p.fills = [trade("0.25", "99", "0.02475")];
  await runExecutionOnce(db, p);
  await requestTestnetCancel(db, uid, o.id);
  assert.equal((await runExecutionOnce(db, p)).state, "terminal");
  assert.equal(await balance(uid, "USDT", "locked"), "0");
  assert.equal(await balance(uid, "USDT", "available"), "975.22525");
  assert.equal(await balance(uid, "BTC", "available"), "0.25");
});
test("unfunded third-asset commission stops for review without inventing a fill", async () => {
  const uid = await user(),
    o = await queueTestnetOrder(db, uid, body, id(), catalog),
    p = provider();
  p.snapshot = { orderId: "42", status: "FILLED", executedQty: "1" };
  p.fills = [trade("1", "100", "0.001", "BNB")];
  assert.equal((await runExecutionOnce(db, p)).state, "review");
  assert.equal(
    (await db.query("SELECT * FROM fills WHERE order_id=$1", [o.id])).rows
      .length,
    0,
  );
  assert.equal(await balance(uid, "USDT", "locked"), "100.1");
});
test("concurrent workers claim once, and zero fee strings are accepted", async () => {
  const uid = await user(),
    o = await queueTestnetOrder(db, uid, body, id(), catalog),
    p = provider();
  p.snapshot = { orderId: "42", status: "FILLED", executedQty: "1" };
  p.fills = [trade("1", "100", "0.00000000")];
  const results = await Promise.all([
    runExecutionOnce(db, p),
    runExecutionOnce(db, p),
  ]);
  assert.equal(p.posts, 1);
  assert.ok(results.some((r) => r.idle));
  assert.equal(await balance(uid, "USDT", "available"), "900");
  await assert.rejects(
    fillOrder(db, o.id, "1", "100", id()),
    (e) => e.code === "PROVIDER_ORDER_REQUIRES_RECONCILIATION",
  );
});
test("testnet market buys reserve a disclosed slippage buffer and settle actual cost", async () => {
  const uid = await user(),
    o = await queueTestnetOrder(
      db,
      uid,
      { ...body, type: "MARKET" },
      id(),
      catalog,
    ),
    p = provider();
  assert.equal(await balance(uid, "USDT", "locked"), "102.102");
  p.snapshot = { orderId: "42", status: "FILLED", executedQty: "1" };
  p.fills = [trade("1", "101", "0.101")];
  assert.equal((await runExecutionOnce(db, p)).status, "filled");
  assert.equal(await balance(uid, "USDT", "available"), "898.899");
});
