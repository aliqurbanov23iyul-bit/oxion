import { D, id, fail, lockUser, transfer } from "./core.js";
import { createOrder, fillOrder, cancelOrder } from "./finance.js";

// A durable, testnet-only outbox. Market data never implies order execution.
export async function queueTestnetOrder(db, user, body, key, catalog) {
  return db.transaction(async (tx) => {
    const scoped = { transaction: (fn) => fn(tx) };
    const o = await createOrder(scoped, user, body, "testnet-" + key, catalog);
    const existing = (
      await tx.query("SELECT * FROM execution_jobs WHERE order_id=$1", [o.id])
    ).rows[0];
    if (existing)
      return {
        ...o,
        execution_mode: "binance-testnet",
        job_state: existing.state,
      };
    const order = (await tx.query("SELECT * FROM orders WHERE id=$1", [o.id]))
      .rows[0];
    if (order.type === "MARKET" && order.side === "BUY") {
      const extra = new D(order.reserved)
        .mul("0.02")
        .toDecimalPlaces(18, D.ROUND_DOWN);
      await transfer(
        tx,
        user,
        "USDT",
        "available",
        "locked",
        extra,
        "testnet-buffer:" + o.id,
        "order_reserve",
      );
      await tx.query("UPDATE orders SET reserved=reserved+$1 WHERE id=$2", [
        extra.toFixed(18),
        o.id,
      ]);
    }
    const client = "OX" + o.id.replaceAll("-", "");
    await tx.query(
      "UPDATE orders SET execution_mode='binance-testnet' WHERE id=$1",
      [o.id],
    );
    await tx.query(
      "INSERT INTO execution_jobs(order_id,client_order_id) VALUES($1,$2)",
      [o.id, client],
    );
    return { ...o, execution_mode: "binance-testnet", job_state: "queued" };
  });
}
export async function requestTestnetCancel(db, user, oid) {
  const r = await db.query(
    "UPDATE execution_jobs SET cancel_requested=TRUE,next_at=now() WHERE order_id IN (SELECT id FROM orders WHERE id=$1 AND user_id=$2 AND execution_mode='binance-testnet' AND status IN ('open','partial')) AND state<>'terminal' RETURNING order_id",
    [oid, user],
  );
  if (!r.rows.length) fail(409, "INVALID_STATE");
  return { status: "cancel_requested", mode: "binance-testnet" };
}
async function finishRejected(db, job, status) {
  await db.transaction(async (tx) => {
    if (
      !(
        await tx.query(
          "SELECT order_id FROM execution_jobs WHERE order_id=$1 AND lease_token=$2 FOR UPDATE",
          [job.order_id, job.lease_token],
        )
      ).rows.length
    )
      return;
    const o = (
      await tx.query("SELECT * FROM orders WHERE id=$1", [job.order_id])
    ).rows[0];
    await lockUser(tx, o.user_id);
    if (["open", "partial"].includes(o.status)) {
      await cancelOrder({ transaction: (fn) => fn(tx) }, o.user_id, o.id, {
        provider: true,
        status,
      });
    }
    await tx.query(
      "UPDATE execution_jobs SET state='terminal',lease_until=NULL,last_error=NULL WHERE order_id=$1",
      [o.id],
    );
  });
}
export async function runExecutionOnce(db, provider) {
  const job = await db.transaction(async (tx) => {
    const row = (
      await tx.query(
        "SELECT j.*,o.symbol,o.side,o.type,o.quantity,o.price FROM execution_jobs j JOIN orders o ON o.id=j.order_id WHERE j.state NOT IN ('terminal','review') AND j.next_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now()) ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!row) return null;
    row.lease_token = id();
    await tx.query(
      "UPDATE execution_jobs SET state='unknown',attempts=attempts+1,lease_until=now()+interval '60 seconds',lease_token=$2 WHERE order_id=$1",
      [row.order_id, row.lease_token],
    );
    return row;
  });
  if (!job) return { idle: true };
  try {
    if (job.state === "queued" && job.cancel_requested) {
      await finishRejected(db, job, "cancelled");
      return { state: "terminal", status: "cancelled" };
    }
    if (job.state === "queued") {
      // Persisted as unknown before submission: a crash can never cause a blind retry.
      try {
        await provider.order({
          id: job.client_order_id,
          symbol: job.symbol,
          side: job.side,
          type: job.type,
          quantity: job.quantity,
          price: job.price,
        });
      } catch (error) {
        if (error.definitiveRejection) {
          await finishRejected(db, job, "rejected");
          return { state: "terminal", status: "rejected" };
        }
        throw error;
      }
    }
    let remote = await provider.status(job.symbol, job.client_order_id);
    if (
      remote.symbol !== job.symbol ||
      remote.clientOrderId !== job.client_order_id ||
      remote.side !== job.side ||
      remote.type !== job.type ||
      !new D(remote.origQty).eq(job.quantity)
    )
      fail(409, "PROVIDER_EVENT_MISMATCH");
    if (
      job.cancel_requested &&
      ![
        "FILLED",
        "CANCELED",
        "REJECTED",
        "EXPIRED",
        "EXPIRED_IN_MATCH",
      ].includes(remote.status)
    ) {
      await provider.cancel(job.symbol, job.client_order_id);
      remote = await provider.status(job.symbol, job.client_order_id);
      if (
        remote.symbol !== job.symbol ||
        remote.clientOrderId !== job.client_order_id ||
        remote.side !== job.side ||
        remote.type !== job.type ||
        !new D(remote.origQty).eq(job.quantity)
      )
        fail(409, "PROVIDER_EVENT_MISMATCH");
    }
    await db.query("UPDATE orders SET provider_id=$1 WHERE id=$2", [
      String(remote.orderId),
      job.order_id,
    ]);
    const trades = await provider.trades(job.symbol, remote.orderId);
    if (trades.length >= 1000) fail(409, "PROVIDER_PAGINATION_REQUIRES_REVIEW");
    for (const trade of trades) {
      if (
        String(trade.orderId) !== String(remote.orderId) ||
        trade.symbol !== job.symbol
      )
        fail(409, "PROVIDER_EVENT_MISMATCH");
      await fillOrder(
        db,
        job.order_id,
        trade.qty,
        trade.price,
        "binance-testnet:" + job.symbol + ":" + trade.id,
        {
          provider: true,
          feeAmount: trade.commission,
          feeAsset: trade.commissionAsset,
          quoteAmount: trade.quoteQty,
        },
      );
    }
    const local = (
      await db.query("SELECT * FROM orders WHERE id=$1", [job.order_id])
    ).rows[0];
    if (!new D(local.filled).eq(remote.executedQty))
      fail(409, "PROVIDER_TRADES_PENDING");
    if (
      ["CANCELED", "REJECTED", "EXPIRED", "EXPIRED_IN_MATCH"].includes(
        remote.status,
      )
    ) {
      await finishRejected(
        db,
        job,
        remote.status === "REJECTED"
          ? "rejected"
          : remote.status.startsWith("EXPIRED")
            ? "expired"
            : "cancelled",
      );
      return { state: "terminal", status: remote.status };
    }
    if (remote.status === "FILLED") {
      if (local.status !== "filled") fail(409, "PROVIDER_EVENT_MISMATCH");
      await db.query(
        "UPDATE execution_jobs SET state='terminal',lease_until=NULL,last_error=NULL WHERE order_id=$1 AND lease_token=$2",
        [job.order_id, job.lease_token],
      );
      return { state: "terminal", status: "filled" };
    }
    await db.query(
      "UPDATE execution_jobs SET state='accepted',lease_until=NULL,next_at=now()+interval '5 seconds',last_error=NULL WHERE order_id=$1 AND lease_token=$2",
      [job.order_id, job.lease_token],
    );
    return { state: "accepted", status: local.status };
  } catch (error) {
    const needsReview =
      [
        "INSUFFICIENT_RESERVE",
        "INSUFFICIENT_BALANCE",
        "UNSUPPORTED_FEE_ASSET",
        "PROVIDER_EVENT_MISMATCH",
        "PROVIDER_PAGINATION_REQUIRES_REVIEW",
        "INVALID_FILL",
        "INVALID_AMOUNT",
      ].includes(error.code) || job.attempts >= 11;
    await db.query(
      "UPDATE execution_jobs SET state=$1,lease_until=NULL,next_at=now()+interval '5 seconds',last_error=$2 WHERE order_id=$3 AND lease_token=$4",
      [
        needsReview ? "review" : "unknown",
        String(
          error.code || error.providerCode || "PROVIDER_CONNECTION_UNCERTAIN",
        ),
        job.order_id,
        job.lease_token,
      ],
    );
    return {
      state: needsReview ? "review" : "unknown",
      order_id: job.order_id,
    };
  }
}
