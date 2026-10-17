import "dotenv/config";
import { database } from "../server/db.js";
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url)
  throw Error(
    "Set DATABASE_URL_UNPOOLED (Neon direct connection) before migrating.",
  );
if (process.env.MIGRATION_ACK !== "OXION_TEST_ONLY")
  throw Error(
    "Set MIGRATION_ACK=OXION_TEST_ONLY to explicitly target the selected test database.",
  );
let db;
try {
  db = await database(url, undefined, { migrate: true });
  console.log(
    "OXION schema applied transactionally. Existing account and ledger rows are preserved.",
  );
} catch {
  console.error(
    "Migration failed. Check the selected database, SSL and role permissions. No credentials were logged.",
  );
  process.exitCode = 1;
} finally {
  await db?.close();
}
