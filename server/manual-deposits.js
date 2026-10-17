import { id, fail, amount, D, lockUser, account, post } from "./core.js";
import { assets } from "./providers.js";
export async function saveMethod(db, admin, b) {
  if (
    ![...assets, "USDT"].includes(b.asset) ||
    !/^[A-Z0-9-]{2,30}$/.test(b.network || "") ||
    !/^[a-zA-Z0-9:._-]{14,150}$/.test(b.address || "") ||
    String(b.memo || "").length > 120
  )
    fail(400, "INVALID_NETWORK_ADDRESS");
  if (
    ["BEP20", "ERC20", "ETH-SEPOLIA"].includes(b.network) &&
    !/^0x[a-fA-F0-9]{40}$/.test(b.address)
  )
    fail(400, "INVALID_NETWORK_ADDRESS");
  const minimum = amount(b.minimum);
  const confirmations = Number(b.confirmations);
  if (
    !Number.isInteger(confirmations) ||
    confirmations < 1 ||
    confirmations > 10000
  )
    fail(400, "INVALID_FORM");
  const result = await db.query(
    "INSERT INTO deposit_methods(id,asset,network,address,memo,minimum,confirmations,active,actor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
    [
      id(),
      b.asset,
      b.network,
      b.address,
      b.memo || "",
      minimum.toFixed(18),
      confirmations,
      b.active === true,
      admin,
    ],
  );
  return result.rows[0];
}
export async function submitDeposit(db, user, b) {
  if (!/^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$/.test(b.txid || ""))
    fail(400, "INVALID_TXID");
  const value = amount(b.amount),
    txid = b.txid.toLowerCase();
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const method = (
      await tx.query(
        "SELECT * FROM deposit_methods WHERE id=$1 AND active=TRUE FOR SHARE",
        [b.method],
      )
    ).rows[0];
    if (!method) fail(404, "NOT_FOUND");
    if (value.lt(method.minimum)) fail(400, "BELOW_MINIMUM");
    const result = await tx.query(
      "INSERT INTO deposit_requests(id,user_id,method_id,asset,network,address,memo,amount,txid) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(network,txid) DO NOTHING RETURNING *",
      [
        id(),
        user,
        method.id,
        method.asset,
        method.network,
        method.address,
        method.memo,
        value.toFixed(18),
        txid,
      ],
    );
    if (result.rows.length) return result.rows[0];
    const old = (
      await tx.query(
        "SELECT * FROM deposit_requests WHERE network=$1 AND txid=$2",
        [method.network, txid],
      )
    ).rows[0];
    if (
      old.user_id !== user ||
      old.method_id !== method.id ||
      !new D(old.amount).eq(value)
    )
      fail(409, "IDEMPOTENCY_CONFLICT");
    return old;
  });
}
export async function reviewDeposit(db, admin, request, b) {
  if (
    typeof b.approve !== "boolean" ||
    typeof b.reason !== "string" ||
    b.reason.trim().length < 8 ||
    b.reason.length > 500
  )
    fail(400, "REASON_REQUIRED");
  return db.transaction(async (tx) => {
    const r = (
      await tx.query("SELECT * FROM deposit_requests WHERE id=$1 FOR UPDATE", [
        request,
      ])
    ).rows[0];
    if (!r) fail(404, "NOT_FOUND");
    const old = (
      await tx.query("SELECT * FROM deposit_reviews WHERE request_id=$1", [
        request,
      ])
    ).rows[0];
    if (old) {
      if (old.approved !== b.approve) fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    }
    if (b.approve && b.verified !== true) fail(400, "UNVERIFIED_DEPOSIT");
    let journal = null;
    if (b.approve) {
      await lockUser(tx, r.user_id);
      const a = await account(tx, r.user_id, r.asset, "available"),
        c = await account(tx, null, r.asset, "custody");
      journal = await post(tx, {
        reference: "manual-deposit:" + r.id,
        kind: "admin_confirmed_deposit",
        actor: admin,
        reason: b.reason,
        lines: [
          { account: a, amount: r.amount },
          { account: c, amount: new D(r.amount).neg() },
        ],
      });
    }
    return (
      await tx.query(
        "INSERT INTO deposit_reviews(request_id,actor,approved,reason,journal_id) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [r.id, admin, b.approve, b.reason, journal],
      )
    ).rows[0];
  });
}
