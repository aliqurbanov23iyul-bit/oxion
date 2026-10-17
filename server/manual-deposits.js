import { id, fail, amount, D, lockUser, account, post } from "./core.js";
import { markets } from "./providers.js";
import { depositPreset } from "../public/assets/deposit-catalog.js";
export async function depositPrice(asset, getMarkets = markets) {
  if (asset === "USDT") return new D(1);
  const m = (await getMarkets()).find(
    (m) => m.asset === asset && m.supported && m.price,
  );
  if (!m || !new D(m.price).isFinite() || !new D(m.price).gt(0))
    fail(503, "MARKET_UNAVAILABLE");
  return new D(m.price);
}
export function validateQr(image) {
  if (!image) return null;
  if (
    typeof image !== "string" ||
    image.length > 135000 ||
    !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)
  )
    fail(400, "INVALID_QR_IMAGE");
  const bytes = Buffer.from(image.split(",")[1], "base64");
  if (
    bytes.length > 100000 ||
    !(
      bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
    )
  )
    fail(400, "INVALID_QR_IMAGE");
  return image;
}
const addressPatterns = {
  evm: /^0x[a-fA-F0-9]{40}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  btc: /^(bc1[a-z0-9]{25,87}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  xrp: /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/,
  doge: /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/,
  ada: /^addr1[a-z0-9]{30,110}$/,
  ltc: /^(ltc1[a-z0-9]{25,87}|[LM3][1-9A-HJ-NP-Za-km-z]{25,34})$/,
  bch: /^(bitcoincash:)?[qp][a-z0-9]{41}$/,
};

export async function saveMethod(db, admin, b) {
  const preset = depositPreset(b.asset, b.network);
  if (
    !preset ||
    !addressPatterns[preset.format].test(b.address || "") ||
    String(b.memo || "").length > 120
  )
    fail(400, "INVALID_NETWORK_ADDRESS");
  if (b.memo && !/^[0-9]{1,10}$/.test(b.memo)) fail(400, "INVALID_FORM");
  const qr = validateQr(b.qr_image);
  const minimum = new D("0.000000000000000001");
  const confirmations = Number(b.confirmations);
  if (
    !Number.isInteger(confirmations) ||
    confirmations < 1 ||
    confirmations > 10000
  )
    fail(400, "INVALID_FORM");
  const result = await db.query(
    "INSERT INTO deposit_methods(id,asset,network,address,memo,minimum,confirmations,active,actor,qr_image,minimum_usd) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,10) RETURNING *",
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
      qr,
    ],
  );
  return result.rows[0];
}
export function normalizeDepositTxid(network, value) {
  const sol = network === "SOL";
  if (
    typeof value !== "string" ||
    !(sol ? /^[1-9A-HJ-NP-Za-km-z]{64,90}$/ : /^(0x)?[a-fA-F0-9]{64}$/).test(
      value,
    )
  )
    fail(400, "INVALID_TXID");
  return sol ? value : value.replace(/^0x/, "").toLowerCase();
}
export async function submitDeposit(db, user, b, getMarkets = markets) {
  const initial = (
    await db.query(
      "SELECT * FROM deposit_methods WHERE id=$1 AND active=TRUE",
      [b.method],
    )
  ).rows[0];
  if (!initial) fail(404, "NOT_FOUND");
  const value = amount(b.amount),
    txid = b.txid ? normalizeDepositTxid(initial.network, b.txid) : null;
  const requestKey =
    typeof b.request_key === "string" &&
    /^[a-zA-Z0-9-]{8,100}$/.test(b.request_key)
      ? b.request_key
      : null;
  if (!txid && !requestKey) fail(400, "INVALID_FORM");
  const findOld = async (tx) => {
    if (requestKey) {
      const old = (
        await tx.query(
          "SELECT * FROM deposit_requests WHERE user_id=$1 AND request_key=$2",
          [user, requestKey],
        )
      ).rows[0];
      if (old) return old;
    }
    if (txid)
      return (
        await tx.query(
          "SELECT * FROM deposit_requests WHERE network=$1 AND (CASE WHEN network='SOL' THEN txid ELSE regexp_replace(lower(txid),'^0x','') END)=$2",
          [initial.network, txid],
        )
      ).rows[0];
  };
  const match = (old) => {
    if (
      old.user_id !== user ||
      old.method_id !== initial.id ||
      !new D(old.amount).eq(value) ||
      (txid && normalizeDepositTxid(old.network, old.txid) !== txid)
    )
      fail(409, "IDEMPOTENCY_CONFLICT");
    return old;
  };
  const old = await findOld(db);
  if (old) return match(old);
  const price = await depositPrice(initial.asset, getMarkets),
    usdValue = value.mul(price);
  if (usdValue.lt(initial.minimum_usd || "10"))
    fail(400, "DEPOSIT_MINIMUM_USD");
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const method = (
      await tx.query(
        "SELECT * FROM deposit_methods WHERE id=$1 AND active=TRUE FOR SHARE",
        [b.method],
      )
    ).rows[0];
    if (!method) fail(404, "NOT_FOUND");
    const old = await findOld(tx);
    if (old) return match(old);
    const result = await tx.query(
      "INSERT INTO deposit_requests(id,user_id,method_id,asset,network,address,memo,amount,txid,usd_price,usd_value,request_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING RETURNING *",
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
        price.toFixed(18),
        usdValue.toFixed(18),
        requestKey,
      ],
    );
    if (result.rows.length) return result.rows[0];
    const found = await findOld(tx);
    if (!found) fail(409, "IDEMPOTENCY_CONFLICT");
    return match(found);
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
      if (
        old.approved !== b.approve ||
        (b.txid &&
          old.txid &&
          normalizeDepositTxid(r.network, b.txid) !== old.txid)
      )
        fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    }
    if (b.approve && b.verified !== true) fail(400, "UNVERIFIED_DEPOSIT");
    let journal = null;
    const txid = b.approve
      ? normalizeDepositTxid(r.network, b.txid || r.txid)
      : null;
    if (b.approve) {
      await lockUser(tx, r.user_id);
      const duplicate = await tx.query(
        "SELECT d.id FROM deposit_requests d JOIN deposit_reviews v ON v.request_id=d.id WHERE v.approved=TRUE AND d.network=$1 AND d.id<>$2 AND (CASE WHEN d.network='SOL' THEN coalesce(v.txid,d.txid) ELSE regexp_replace(lower(coalesce(v.txid,d.txid)),'^0x','') END)=$3",
        [r.network, r.id, txid],
      );
      const custody = await tx.query(
        "SELECT id FROM deposits WHERE network=$1 AND status='confirmed' AND (CASE WHEN network='SOL' THEN txid ELSE regexp_replace(lower(txid),'^0x','') END)=$2",
        [r.network, txid],
      );
      if (duplicate.rows.length || custody.rows.length)
        fail(409, "IDEMPOTENCY_CONFLICT");
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
        "INSERT INTO deposit_reviews(request_id,actor,approved,reason,journal_id,txid,network) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [r.id, admin, b.approve, b.reason, journal, txid, r.network],
      )
    ).rows[0];
  });
}
