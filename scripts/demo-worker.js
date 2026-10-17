import "dotenv/config";
import { database } from "../server/db.js";
import { startDemoEngine } from "../server/directional.js";
const db = await database(
  process.env.DATABASE_URL,
  process.env.LOCAL_DATABASE_PATH,
  { migrate: !process.env.DATABASE_URL },
);
const engine = startDemoEngine(db);
console.log("OXION simulation price worker: 250 ms. Virtual demo only.");
const close = async () => {
  await engine.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", close);
process.on("SIGTERM", close);
setInterval(() => {}, 60000);
