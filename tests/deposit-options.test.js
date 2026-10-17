import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import {
  saveMethod,
  submitDeposit,
  validateQr,
} from "../server/manual-deposits.js";
import { depositCatalog } from "../public/assets/deposit-catalog.js";
test("15 deposit presets, USD threshold, price failures, case-sensitive Solana and QR limits", async () => {
  const db = await database(null, "memory://");
  try {
    await db.query(
      "INSERT INTO users(id,uid,email) VALUES('a','OX-12121212','a@test.invalid'),('u','OX-23232323','u@test.invalid')",
    );
    assert.equal(depositCatalog.length, 15);
    assert.equal(new Set(depositCatalog.map((p) => p.id)).size, 15);
    const btc = await saveMethod(db, "a", {
      asset: "BTC",
      network: "BTC",
      address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      confirmations: 3,
      active: true,
      minimum: "0",
    });
    const getMarkets = async () => [
      { asset: "BTC", supported: true, price: "50000" },
    ];
    await assert.rejects(
      submitDeposit(
        db,
        "u",
        {
          method: btc.id,
          txid: "a".repeat(64),
          amount: "0.000199999999999999",
        },
        getMarkets,
      ),
      (e) => e.code === "DEPOSIT_MINIMUM_USD",
    );
    const r = await submitDeposit(
      db,
      "u",
      { method: btc.id, txid: "a".repeat(64), amount: "0.0002" },
      getMarkets,
    );
    assert.equal(r.usd_value, "10.000000000000000000");
    assert.equal(
      (
        await submitDeposit(
          db,
          "u",
          { method: btc.id, txid: "0x" + "A".repeat(64), amount: "0.0002" },
          async () => {
            throw Error("no market");
          },
        )
      ).id,
      r.id,
    );
    await assert.rejects(
      submitDeposit(
        db,
        "u",
        { method: btc.id, txid: "b".repeat(64), amount: "1" },
        async () => [],
      ),
      (e) => e.code === "MARKET_UNAVAILABLE",
    );
    const sol = await saveMethod(db, "a", {
      asset: "SOL",
      network: "SOL",
      address: "11111111111111111111111111111111",
      confirmations: 32,
      active: true,
    });
    const solTx = "Ab".repeat(40),
      s = await submitDeposit(
        db,
        "u",
        { method: sol.id, txid: solTx, amount: "1" },
        async () => [{ asset: "SOL", supported: true, price: "100" }],
      );
    assert.equal(s.txid, solTx);
    await assert.rejects(
      saveMethod(db, "a", {
        asset: "USDT",
        network: "TRC20",
        address: "0x" + "1".repeat(40),
        confirmations: 20,
      }),
      (e) => e.code === "INVALID_NETWORK_ADDRESS",
    );
    assert.equal(validateQr(null), null);
    assert.throws(
      () => validateQr("data:image/svg+xml;base64,PHN2Zz4="),
      (e) => e.code === "INVALID_QR_IMAGE",
    );
    assert.throws(
      () => validateQr("data:image/png;base64,YWJj"),
      (e) => e.code === "INVALID_QR_IMAGE",
    );
    assert.throws(
      () => validateQr("data:image/png;base64," + "a".repeat(140000)),
      (e) => e.code === "INVALID_QR_IMAGE",
    );
  } finally {
    await db.close();
  }
});
