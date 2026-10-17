import test from "node:test";
import assert from "node:assert/strict";
import { database } from "../server/db.js";
import { id } from "../server/core.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
test("embedded PostgreSQL persists across a clean close and prevents concurrent opening", async () => {
  const path = await mkdtemp(join(tmpdir(), "oxion-persistence-"));
  const db = await database(null, path);
  await db.query(
    "INSERT INTO users(id,uid,email) VALUES('persistence-user','OX-12345678','persist@example.invalid')",
  );
  await assert.rejects(database(null, path), /already open/);
  await db.close();
  const reopened = await database(null, path);
  assert.equal(
    (await reopened.query("SELECT uid FROM users")).rows[0].uid,
    "OX-12345678",
  );
  await reopened.close();
  const absolute = resolve(path);
  if (
    !absolute.startsWith(resolve(tmpdir()) + sep) ||
    !basename(absolute).startsWith("oxion-persistence-")
  )
    throw Error("Unsafe test cleanup path");
  await rm(absolute, { recursive: true, force: true });
});
