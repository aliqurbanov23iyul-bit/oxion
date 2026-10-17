import {
  D,
  id,
  hash,
  fail,
  amount,
  lockUser,
  account,
  post,
  transfer,
  quantize,
} from "./core.js";
import { assets, networks } from "./providers.js";
export async function adjustment(db, admin, user, asset, value, reason, key) {
  if (
    ![...assets, "USDT"].includes(asset) ||
    typeof reason !== "string" ||
    reason.trim().length < 8
  )
    fail(400, "REASON_REQUIRED");
  if (
    typeof value !== "string" ||
    !/^[-]?\d{1,18}(\.\d{1,18})?$/.test(value) ||
    new D(value).eq(0)
  )
    fail(400, "INVALID_AMOUNT");
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const old = (
      await tx.query(
        "SELECT j.id,j.actor,j.reason,a.user_id,a.asset,e.amount FROM journals j JOIN entries e ON e.journal_id=j.id JOIN accounts a ON a.id=e.account_id WHERE j.reference=$1 AND a.user_id IS NOT NULL",
        ["adjust:" + key],
      )
    ).rows[0];
    if (old) {
      if (
        old.actor !== admin ||
        old.user_id !== user ||
        old.asset !== asset ||
        old.reason !== reason ||
        !new D(old.amount).eq(value)
      )
        fail(409, "IDEMPOTENCY_CONFLICT");
      return old.id;
    }
    const a = await account(tx, user, asset, "manual"),
      b = await account(tx, null, asset, "adjustment");
    return post(tx, {
      reference: "adjust:" + key,
      kind: "manual_adjustment",
      actor: admin,
      reason,
      lines: [
        { account: a, amount: value },
        { account: b, amount: new D(value).neg() },
      ],
    });
  });
}
// Only a trusted, independently verified custody adapter may call this function.
// There is intentionally no public webhook route until that adapter is configured.
export async function confirmedDeposit(db, event) {
  if (
    event.verified !== true ||
    !Number.isInteger(event.confirmations) ||
    !Number.isInteger(event.requiredConfirmations) ||
    event.requiredConfirmations < 1 ||
    event.confirmations < event.requiredConfirmations ||
    !event.provider ||
    !event.txid ||
    !event.transferId
  )
    fail(400, "UNVERIFIED_DEPOSIT");
  const v = amount(event.amount);
  const network = networks.find(
    (n) => n.asset === event.asset && n.network === event.network,
  );
  if (!network) fail(400, "INVALID_NETWORK_ADDRESS");
  if (v.lt(network.minimum)) fail(400, "BELOW_MINIMUM");
  if (event.confirmations < network.confirmations)
    fail(400, "UNVERIFIED_DEPOSIT");
  return db.transaction(async (tx) => {
    await lockUser(tx, event.user);
    const eventId = hash(event.provider + ":" + event.transferId);
    const exists = await tx.query("SELECT * FROM deposits WHERE id=$1", [
      eventId,
    ]);
    if (exists.rows.length) {
      const old = exists.rows[0];
      if (
        old.user_id !== event.user ||
        old.asset !== event.asset ||
        old.network !== event.network ||
        old.txid !== event.txid ||
        !new D(old.amount).eq(v)
      )
        fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    }
    const a = await account(tx, event.user, event.asset, "available"),
      b = await account(tx, null, event.asset, "custody");
    await post(tx, {
      reference: "deposit:" + eventId,
      kind: "crypto_deposit",
      lines: [
        { account: a, amount: v },
        { account: b, amount: v.neg() },
      ],
    });
    await tx.query(
      "INSERT INTO deposits(id,user_id,asset,network,amount,txid,status,confirmations) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        eventId,
        event.user,
        event.asset,
        event.network,
        v.toFixed(18),
        event.txid,
        "confirmed",
        event.confirmations,
      ],
    );
    return { id: eventId, status: "confirmed" };
  });
}
export function quoteWithdrawal(b) {
  const value = amount(b.amount);
  if (
    b.asset !== "USDT" ||
    b.network !== "ETH-SEPOLIA" ||
    !/^0x[a-fA-F0-9]{40}$/.test(b.address || "")
  )
    fail(400, "INVALID_NETWORK_ADDRESS");
  if (value.lt(10)) fail(400, "BELOW_MINIMUM");
  return {
    asset: b.asset,
    network: b.network,
    address: b.address,
    amount: value.toFixed(18),
    fee: "1.000000000000000000",
    total: value.plus(1).toFixed(18),
    receive: value.toFixed(18),
    mode: "local-simulation",
  };
}
export async function withdrawal(db, user, b, key) {
  const v = amount(b.amount),
    fee = new D(1);
  if (
    b.asset !== "USDT" ||
    b.network !== "ETH-SEPOLIA" ||
    !/^0x[a-fA-F0-9]{40}$/.test(b.address || "")
  )
    fail(400, "INVALID_NETWORK_ADDRESS");
  if (v.lt(10)) fail(400, "BELOW_MINIMUM");
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const old = (
      await tx.query(
        "SELECT * FROM withdrawals WHERE user_id=$1 AND request_key=$2",
        [user, key],
      )
    ).rows[0];
    if (old) {
      if (
        old.asset !== b.asset ||
        old.network !== b.network ||
        old.address !== b.address ||
        !new D(old.amount).eq(v)
      )
        fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    }
    const wid = id();
    await transfer(
      tx,
      user,
      b.asset,
      "available",
      "locked",
      v.plus(fee),
      "withdraw:" + wid,
      "withdrawal_reserve",
    );
    await tx.query(
      "INSERT INTO withdrawals(id,user_id,request_key,asset,network,address,memo,amount,fee,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        wid,
        user,
        key,
        b.asset,
        b.network,
        b.address,
        b.memo || null,
        v.toFixed(18),
        fee.toFixed(18),
        "awaiting_review",
      ],
    );
    return { id: wid, status: "awaiting_review", mode: "local-simulation" };
  });
}
export async function reviewWithdrawal(db, admin, wid, approve) {
  return db.transaction(async (tx) => {
    const w = (
      await tx.query("SELECT * FROM withdrawals WHERE id=$1 FOR UPDATE", [wid])
    ).rows[0];
    if (!w) fail(404, "NOT_FOUND");
    await lockUser(tx, w.user_id);
    if (w.status !== "awaiting_review") fail(409, "INVALID_STATE");
    if (approve) fail(503, "CUSTODY_NOT_CONFIGURED");
    await transfer(
      tx,
      w.user_id,
      w.asset,
      "locked",
      "available",
      new D(w.amount).plus(w.fee),
      "withdraw-release:" + wid,
      "withdrawal_rejected",
    );
    await tx.query("UPDATE withdrawals SET status='failed' WHERE id=$1", [wid]);
    return { status: "failed" };
  });
}
export function validateOrder(b, catalog) {
  if (
    !["BUY", "SELL"].includes(b.side) ||
    !["MARKET", "LIMIT"].includes(b.type)
  )
    fail(400, "INVALID_ORDER");
  const m = catalog.find((m) => m.symbol === b.symbol && m.supported);
  if (!m) fail(400, "UNSUPPORTED_PAIR");
  const q = amount(b.quantity),
    p = b.type === "LIMIT" ? amount(b.price) : amount(m.price);
  if (q.mul(p).lt(5)) fail(400, "BELOW_MINIMUM");
  for (const f of m.filters || []) {
    if (
      f.filterType === "MARKET_LOT_SIZE" &&
      b.type === "MARKET" &&
      ((new D(f.minQty).gt(0) && q.lt(f.minQty)) ||
        (new D(f.maxQty).gt(0) && q.gt(f.maxQty)) ||
        (new D(f.stepSize).gt(0) && !q.mod(f.stepSize).eq(0)))
    )
      fail(400, "INVALID_QUANTITY_STEP");
    if (
      f.filterType === "NOTIONAL" &&
      new D(f.maxNotional || 0).gt(0) &&
      q.mul(p).gt(f.maxNotional)
    )
      fail(400, "ABOVE_MAXIMUM");
    if (
      f.filterType === "LOT_SIZE" &&
      (q.lt(f.minQty) || q.gt(f.maxQty) || !q.mod(f.stepSize).eq(0))
    )
      fail(400, "INVALID_QUANTITY_STEP");
    if (
      f.filterType === "PRICE_FILTER" &&
      b.type === "LIMIT" &&
      (p.lt(f.minPrice) || p.gt(f.maxPrice) || !p.mod(f.tickSize).eq(0))
    )
      fail(400, "INVALID_PRICE_STEP");
    if (
      ["MIN_NOTIONAL", "NOTIONAL"].includes(f.filterType) &&
      q.mul(p).lt(f.minNotional)
    )
      fail(400, "BELOW_MINIMUM");
  }
  return { m, q, p };
}
export async function createOrder(db, user, b, key, catalog) {
  const { m, q, p } = validateOrder(b, catalog);
  const fingerprint = hash(
    JSON.stringify({
      symbol: b.symbol,
      side: b.side,
      type: b.type,
      quantity: q.toString(),
      price: b.type === "LIMIT" ? p.toString() : null,
    }),
  );
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const old = (
      await tx.query(
        "SELECT * FROM orders WHERE user_id=$1 AND request_key=$2",
        [user, key],
      )
    ).rows[0];
    if (old) {
      if (old.request_hash !== fingerprint) fail(409, "IDEMPOTENCY_CONFLICT");
      return old;
    }
    const oid = id(),
      baseCost = quantize(q.mul(p)),
      reserved =
        b.side === "BUY" ? baseCost.plus(quantize(baseCost.mul("0.001"))) : q;
    await transfer(
      tx,
      user,
      b.side === "BUY" ? "USDT" : m.asset,
      "available",
      "locked",
      reserved,
      "order:" + oid,
      "order_reserve",
    );
    await tx.query(
      "INSERT INTO orders(id,user_id,request_key,request_hash,symbol,side,type,quantity,price,reserved,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        oid,
        user,
        key,
        fingerprint,
        b.symbol,
        b.side,
        b.type,
        q.toFixed(18),
        p.toFixed(18),
        reserved.toFixed(18),
        "open",
      ],
    );
    return { id: oid, status: "open", mode: "local-simulation" };
  });
}
export async function fillOrder(
  db,
  oid,
  qty,
  price,
  executionId,
  options = {},
) {
  return db.transaction(async (tx) => {
    const o = (
      await tx.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [oid])
    ).rows[0];
    if (!o) fail(404, "NOT_FOUND");
    if (o.execution_mode !== "local-simulation" && !options.provider)
      fail(409, "PROVIDER_ORDER_REQUIRES_RECONCILIATION");
    await lockUser(tx, o.user_id);
    const previous = (
      await tx.query("SELECT order_id FROM fills WHERE id=$1", [executionId])
    ).rows[0];
    if (previous) {
      if (previous.order_id !== oid) fail(409, "IDEMPOTENCY_CONFLICT");
      return { duplicate: true };
    }
    if (!["open", "partial"].includes(o.status)) fail(409, "INVALID_STATE");
    const q = amount(qty),
      p = amount(price),
      remaining = new D(o.quantity).minus(o.filled);
    if (
      q.gt(remaining) ||
      (o.side === "BUY" && o.type === "LIMIT" && p.gt(o.price)) ||
      (o.side === "SELL" && o.type === "LIMIT" && p.lt(o.price))
    )
      fail(400, "INVALID_FILL");
    const suppliedFee = options.feeAmount === 0 ? "0" : options.feeAmount;
    if (
      options.provider &&
      (typeof suppliedFee !== "string" ||
        !/^\d{1,18}(\.\d{1,18})?$/.test(suppliedFee))
    )
      fail(400, "INVALID_FILL");
    const asset = o.symbol.replace(/USDT$/, ""),
      cost = options.provider
        ? amount(options.quoteAmount)
        : quantize(q.mul(p)),
      fee = options.provider ? new D(suppliedFee) : quantize(cost.mul("0.001")),
      feeAsset = options.provider ? options.feeAsset : "USDT",
      spent =
        o.side === "BUY"
          ? cost.plus(feeAsset === "USDT" ? fee : 0)
          : q.plus(feeAsset === asset ? fee : 0);
    if (![...assets, "USDT"].includes(feeAsset))
      fail(400, "UNSUPPORTED_FEE_ASSET");
    if (options.provider && cost.minus(q.mul(p)).abs().gt("0.00000001"))
      fail(409, "PROVIDER_EVENT_MISMATCH");
    const locked = await account(
        tx,
        o.user_id,
        o.side === "BUY" ? "USDT" : asset,
        "locked",
      ),
      clearSpent = await account(
        tx,
        null,
        o.side === "BUY" ? "USDT" : asset,
        "clearing",
      ),
      received = await account(
        tx,
        o.user_id,
        o.side === "BUY" ? asset : "USDT",
        "available",
      ),
      clearReceived = await account(
        tx,
        null,
        o.side === "BUY" ? asset : "USDT",
        "clearing",
      );
    const receive =
      o.side === "BUY"
        ? q.minus(feeAsset === asset ? fee : 0)
        : cost.minus(feeAsset === "USDT" ? fee : 0);
    if (receive.lt(0)) fail(400, "INVALID_FILL");
    const lines = [
      { account: locked, amount: spent.neg() },
      { account: clearSpent, amount: spent },
      { account: received, amount: receive },
      { account: clearReceived, amount: receive.neg() },
    ];
    if (feeAsset !== asset && feeAsset !== "USDT" && fee.gt(0)) {
      const feeFrom = await account(tx, o.user_id, feeAsset, "available"),
        feeTo = await account(tx, null, feeAsset, "fees");
      lines.push(
        { account: feeFrom, amount: fee.neg() },
        { account: feeTo, amount: fee },
      );
    }
    await post(tx, {
      reference: "fill:" + executionId,
      kind: options.provider ? "testnet_fill" : "simulation_fill",
      lines,
    });
    const filled = new D(o.filled).plus(q),
      reserve = new D(o.reserved).minus(spent);
    if (reserve.lt(0)) fail(409, "INSUFFICIENT_RESERVE");
    if (filled.eq(o.quantity) && reserve.gt(0))
      await transfer(
        tx,
        o.user_id,
        o.side === "BUY" ? "USDT" : asset,
        "locked",
        "available",
        reserve,
        "order-release:" + oid,
        "order_release",
      );
    await tx.query(
      "INSERT INTO fills(id,order_id,quantity,price,fee,fee_asset) VALUES($1,$2,$3,$4,$5,$6)",
      [
        executionId,
        oid,
        q.toFixed(18),
        p.toFixed(18),
        fee.toFixed(18),
        feeAsset,
      ],
    );
    await tx.query(
      "UPDATE orders SET filled=$1,reserved=$2,status=$3 WHERE id=$4",
      [
        filled.toFixed(18),
        filled.eq(o.quantity) ? "0" : reserve.toFixed(18),
        filled.eq(o.quantity) ? "filled" : "partial",
        oid,
      ],
    );
    return {
      status: filled.eq(o.quantity) ? "filled" : "partial",
      mode: options.provider ? "binance-testnet" : "local-simulation",
    };
  });
}
export async function cancelOrder(db, user, oid, options = {}) {
  return db.transaction(async (tx) => {
    await lockUser(tx, user);
    const o = (
      await tx.query(
        "SELECT * FROM orders WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [oid, user],
      )
    ).rows[0];
    if (!o) fail(404, "NOT_FOUND");
    if (o.execution_mode !== "local-simulation" && !options.provider)
      fail(409, "PROVIDER_ORDER_REQUIRES_RECONCILIATION");
    if (!["open", "partial"].includes(o.status)) fail(409, "INVALID_STATE");
    await transfer(
      tx,
      user,
      o.side === "BUY" ? "USDT" : o.symbol.replace(/USDT$/, ""),
      "locked",
      "available",
      o.reserved,
      "cancel:" + oid,
      "order_cancel",
    );
    const status =
      options.provider &&
      ["cancelled", "rejected", "expired"].includes(options.status)
        ? options.status
        : "cancelled";
    await tx.query("UPDATE orders SET status=$2,reserved=0 WHERE id=$1", [
      oid,
      status,
    ]);
    return { status };
  });
}
