import pg from "pg";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { join } from "node:path";
import { localDataDirectory } from "./paths.js";
export async function database(url, path, options = {}) {
  path = path || join(localDataDirectory(), "postgres");
  let lock;
  if (!url && path !== "memory://") {
    lock = resolve(path) + ".oxion.lock";
    await mkdir(dirname(lock), { recursive: true });
    try {
      const owner = Number(await readFile(lock, "utf8"));
      try {
        process.kill(owner, 0);
        throw Error(
          "Database is already open. Stop the OXION server before running admin or funding tools.",
        );
      } catch (e) {
        if (e.code !== "ESRCH") throw e;
        await unlink(lock);
      }
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await writeFile(lock, String(process.pid), { flag: "wx" });
  }
  const engine = url
    ? new pg.Pool({
        connectionString: url,
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
      })
    : new (await import("@electric-sql/pglite")).PGlite(path);
  if (url)
    engine.on("error", () => console.error("PostgreSQL idle connection error"));
  const query = (sql, params = []) => engine.query(sql, params);
  let queue = Promise.resolve();
  const transaction = async (fn) => {
    if (url) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const c = await engine.connect();
        try {
          await c.query("BEGIN");
          const r = await fn(c);
          await c.query("COMMIT");
          return r;
        } catch (e) {
          await c.query("ROLLBACK");
          if (!["40001", "40P01"].includes(e.code) || attempt === 2) throw e;
        } finally {
          c.release();
        }
      }
    }
    const work = queue.then(() => engine.transaction(fn));
    queue = work.catch(() => {});
    return work;
  };
  await engine.exec?.("SELECT 1");
  try {
    if (options.migrate ?? !url) {
      const schema = await readFile(
        new URL("./schema.sql", import.meta.url),
        "utf8",
      );
      if (url) {
        const client = await engine.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock(73629418)");
          await client.query(schema);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      } else await engine.exec(schema);
    }
  } catch (error) {
    await (url ? engine.end() : engine.close());
    if (lock) await unlink(lock);
    throw error;
  }
  return {
    query,
    transaction,
    close: async () => {
      await (url ? engine.end() : engine.close());
      if (lock) await unlink(lock);
    },
    kind: url ? "PostgreSQL" : "PGlite PostgreSQL (local)",
    location: url ? "configured PostgreSQL" : resolve(path),
  };
}
