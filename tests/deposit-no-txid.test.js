import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import {
  saveMethod,
  submitDeposit,
  reviewDeposit,
} from "../server/manual-deposits.js";
test("customer can report without TXID; admin supplies TXID; duplicate approvals never credit twice", async () => {
  const db = await database(null, "memory://");
  try {
    await db.query(
      "INSERT INTO users(id,uid,email) VALUES('a','OX-12123434','a@test.invalid'),('u','OX-23234545','u@test.invalid'),('v','OX-34345656','v@test.invalid')",
    );
    const method = await saveMethod(db, "a", {
      asset: "USDT",
      network: "BEP20",
      address: "0x" + "1".repeat(40),
      confirmations: 15,
      active: true,
    });
    const body = {
      method: method.id,
      amount: "12",
      request_key: "request-one",
    };
    const [r, retry] = await Promise.all([
      submitDeposit(db, "u", body),
      submitDeposit(db, "u", body),
    ]);
    assert.equal(r.id, retry.id);
    assert.equal(r.txid, null);
    await assert.rejects(
      submitDeposit(db, "u", { ...body, amount: "13" }),
      (e) => e.code === "IDEMPOTENCY_CONFLICT",
    );
    await assert.rejects(
      reviewDeposit(db, "a", r.id, {
        approve: true,
        verified: true,
        reason: "checked on blockchain",
      }),
      (e) => e.code === "INVALID_TXID",
    );
    const second = await submitDeposit(db, "v", {
      ...body,
      request_key: "another-request",
    });
    const decision = {
      approve: true,
      verified: true,
      reason: "checked chain and ownership",
      txid: "0x" + "a".repeat(64),
    };
    const results = await Promise.allSettled([
      reviewDeposit(db, "a", r.id, decision),
      reviewDeposit(db, "a", second.id, decision),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal(
      (
        await db.query(
          "SELECT sum(balance)::text AS b FROM accounts WHERE user_id IN ('u','v') AND bucket='available'",
        )
      ).rows[0].b,
      "12.000000000000000000",
    );
    const winner = results[0].status === "fulfilled" ? r : second;
    assert.equal(
      (
        await reviewDeposit(db, "a", winner.id, {
          ...decision,
          txid: "A".repeat(64),
        })
      ).approved,
      true,
    );
    await assert.rejects(
      reviewDeposit(db, "a", winner.id, { ...decision, txid: "b".repeat(64) }),
      (e) => e.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.equal(
      (
        await db.query("SELECT txid FROM deposit_requests WHERE id=$1", [
          winner.id,
        ])
      ).rows[0].txid,
      null,
    );
    assert.equal(
      (
        await db.query("SELECT txid FROM deposit_reviews WHERE request_id=$1", [
          winner.id,
        ])
      ).rows[0].txid,
      "a".repeat(64),
    );
  } finally {
    await db.close();
  }
});
