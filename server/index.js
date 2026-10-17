import "dotenv/config";
import { database } from "./db.js";
import { createApp } from "./app.js";
import { localSecrets } from "./config.js";
const env = await localSecrets(process.env);
const db = await database(
  process.env.DATABASE_URL,
  process.env.LOCAL_DATABASE_PATH,
);
const server = createApp(db, env).listen(
  Number(process.env.PORT || 4317),
  "127.0.0.1",
  () => {
    console.log("Database: " + db.location);
    console.log(
      "OXION local-simulation: http://localhost:" + (process.env.PORT || 4317),
    );
  },
);
let closing = false;
server.on("error", async (error) => {
  console.error("OXION server could not listen:", error.code || error.message);
  await db.close();
  process.exit(1);
});
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);
// The retained development terminal can also send "stop" for a clean Windows shutdown.
process.stdin.on("data", (chunk) => {
  if (chunk.toString().trim() === "stop") shutdown();
});
