import "dotenv/config";
import { database } from "../server/db.js";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL is required.");
const db = await database(process.env.DATABASE_URL, undefined, {
  migrate: false,
});
try {
  await db.query(
    "DELETE FROM request_limits WHERE reset_at < now()-interval '1 day'",
  );
  console.log(
    "Expired technical rate-limit counters cleaned; financial records were not modified.",
  );
} finally {
  await db.close();
}
