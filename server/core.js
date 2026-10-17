import {
  randomUUID,
  randomBytes,
  createHash,
  scrypt as scryptCb,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { promisify } from "node:util";
import Decimal from "decimal.js";
Decimal.set({ precision: 60, rounding: Decimal.ROUND_DOWN });
export const D = Decimal;
export const quantize = (v) => new D(v).toDecimalPlaces(18, D.ROUND_DOWN);
export const id = () => randomUUID();
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const fail = (status, code) => {
  throw Object.assign(new Error(code), { status, code });
};
export const amount = (v) => {
  if (
    typeof v !== "string" ||
    !/^\d{1,18}(\.\d{1,18})?$/.test(v) ||
    !new D(v).gt(0)
  )
    fail(400, "INVALID_AMOUNT");
  return new D(v);
};
export async function passwordHash(p) {
  if (typeof p !== "string" || p.length < 12 || p.length > 128)
    fail(400, "PASSWORD_LENGTH");
  const salt = token();
  const result = await promisify(scryptCb)(p, salt, 64, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
  return "scrypt:131072:8:1:" + salt + ":" + result.toString("hex");
}
export async function passwordCheck(p, stored) {
  if (!stored || typeof p !== "string" || p.length > 128) return false;
  const modern = stored.startsWith("scrypt:131072:8:1:");
  const parts = stored.split(":"),
    salt = modern ? parts[4] : parts[0],
    h = modern ? parts[5] : parts[1];
  if (
    parts.length !== (modern ? 6 : 2) ||
    !/^([a-f0-9]{64})$/.test(salt || "") ||
    !/^([a-f0-9]{128})$/.test(h || "")
  )
    return false;
  const r = await promisify(scryptCb)(
    p,
    salt,
    64,
    modern ? { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 } : {},
  );
  return timingSafeEqual(r, Buffer.from(h, "hex"));
}
export function vault(key) {
  const k = Buffer.from(key || randomBytes(32).toString("hex"), "hex");
  if (k.length !== 32) throw Error("ENCRYPTION_KEY must be 64 hex characters");
  return {
    encrypt(s) {
      const iv = randomBytes(12),
        c = createCipheriv("aes-256-gcm", k, iv);
      return [
        iv.toString("hex"),
        c.update(s, "utf8", "hex") + c.final("hex"),
        c.getAuthTag().toString("hex"),
      ].join(":");
    },
    decrypt(s) {
      const [iv, data, tag] = s.split(":");
      const c = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "hex"));
      c.setAuthTag(Buffer.from(tag, "hex"));
      return c.update(data, "hex", "utf8") + c.final("utf8");
    },
  };
}
export async function lockUser(tx, user) {
  const result = await tx.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
    user,
  ]);
  if (!result.rows.length) fail(404, "NOT_FOUND");
}
export async function account(tx, user, asset, bucket) {
  const key = `${user || "system"}:${asset}:${bucket}`;
  await tx.query(
    "INSERT INTO accounts(id,user_id,asset,bucket) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [key, user, asset, bucket],
  );
  return key;
}
export async function post(
  tx,
  { reference, kind, actor = null, reason = null, lines },
) {
  lines = lines.map((l) => ({ ...l, amount: quantize(l.amount) }));
  const existing = await tx.query(
    "SELECT id FROM journals WHERE reference=$1",
    [reference],
  );
  if (existing.rows.length) return existing.rows[0].id;
  const sums = {};
  for (const l of lines) {
    const a = (
      await tx.query("SELECT asset FROM accounts WHERE id=$1", [l.account])
    ).rows[0];
    if (!a) fail(400, "ACCOUNT_MISSING");
    sums[a.asset] = (sums[a.asset] || new D(0)).plus(l.amount);
  }
  if (Object.values(sums).some((v) => !v.eq(0)))
    fail(400, "UNBALANCED_JOURNAL");
  const jid = id();
  await tx.query(
    "INSERT INTO journals(id,reference,kind,actor,reason) VALUES($1,$2,$3,$4,$5)",
    [jid, reference, kind, actor, reason],
  );
  for (const l of [...lines].sort((a, b) =>
    a.account.localeCompare(b.account),
  )) {
    const a = (
      await tx.query("SELECT * FROM accounts WHERE id=$1 FOR UPDATE", [
        l.account,
      ])
    ).rows[0];
    const after = new D(a.balance).plus(l.amount);
    if (a.user_id && after.lt(0)) fail(409, "INSUFFICIENT_BALANCE");
    await tx.query("UPDATE accounts SET balance=$1 WHERE id=$2", [
      after.toFixed(18),
      a.id,
    ]);
    await tx.query("INSERT INTO entries VALUES($1,$2,$3,$4,$5,$6)", [
      id(),
      jid,
      a.id,
      new D(l.amount).toFixed(18),
      a.balance,
      after.toFixed(18),
    ]);
  }
  return jid;
}
export async function transfer(
  tx,
  user,
  asset,
  from,
  to,
  value,
  reference,
  kind,
) {
  value = quantize(value);
  const a = await account(tx, user, asset, from),
    b = await account(tx, user, asset, to);
  return post(tx, {
    reference,
    kind,
    lines: [
      { account: a, amount: value.neg() },
      { account: b, amount: value },
    ],
  });
}
