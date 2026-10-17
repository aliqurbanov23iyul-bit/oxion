import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { account, post, D } from "../server/core.js";
import { sizeOrder } from "../server/order-sizing.js";
test("trade sizing includes fees, rounds to both lot steps, rejects overspending and does not reserve funds", async () => {
  const db = await database(null, "memory://");
  try {
    await db.query(
      "INSERT INTO users(id,uid,email) VALUES('u','OX-67676767','sizing@test.invalid')",
    );
    for (const [asset, value] of [
      ["USDT", "100"],
      ["BTC", "3"],
    ])
      await db.transaction(async (tx) => {
        const a = await account(tx, "u", asset, "available"),
          c = await account(tx, null, asset, "custody");
        await post(tx, {
          reference: "fixture:" + asset,
          kind: "test_funding",
          lines: [
            { account: a, amount: value },
            { account: c, amount: new D(value).neg() },
          ],
        });
      });
    const catalog = [
      {
        asset: "BTC",
        symbol: "BTCUSDT",
        price: "100",
        supported: true,
        filters: [
          {
            filterType: "LOT_SIZE",
            minQty: ".002",
            maxQty: "1000",
            stepSize: ".002",
          },
          {
            filterType: "MARKET_LOT_SIZE",
            minQty: ".003",
            maxQty: "1000",
            stepSize: ".003",
          },
          {
            filterType: "PRICE_FILTER",
            minPrice: ".01",
            maxPrice: "1000000",
            tickSize: ".01",
          },
        ],
      },
    ];
    const b = { symbol: "BTCUSDT", side: "BUY", type: "MARKET" };
    const all = await sizeOrder(db, "u", { ...b, percent: 100 }, catalog);
    assert.equal(all.quantity, "0.996000000000000000");
    assert.equal(all.total, "99.699600000000000000");
    assert.ok(new D(all.reserve).lte(100));
    assert.ok(new D(all.quantity).mod(".002").eq(0));
    assert.ok(new D(all.quantity).mod(".003").eq(0));
    const sell = await sizeOrder(
      db,
      "u",
      { ...b, side: "SELL", percent: 50 },
      catalog,
    );
    assert.equal(sell.quantity, "1.500000000000000000");
    assert.equal(sell.total, "149.850000000000000000");
    assert.equal(
      (
        await sizeOrder(
          db,
          "u",
          { ...b, side: "SELL", budget: "149.85" },
          catalog,
        )
      ).quantity,
      sell.quantity,
    );
    await assert.rejects(
      sizeOrder(db, "u", { ...b, budget: "10000" }, catalog),
      (e) => e.code === "INSUFFICIENT_BALANCE",
    );
    await assert.rejects(
      sizeOrder(db, "u", { ...b, percent: 101 }, catalog),
      (e) => e.code === "INVALID_AMOUNT",
    );
    await assert.rejects(
      sizeOrder(
        db,
        "u",
        { ...b, type: "LIMIT", price: "100.005", percent: 50 },
        catalog,
      ),
      (e) => e.code === "INVALID_PRICE_STEP",
    );
    assert.equal(
      (
        await db.query(
          "SELECT balance FROM accounts WHERE id='u:USDT:available'",
        )
      ).rows[0].balance,
      "100.000000000000000000",
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM orders")).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
