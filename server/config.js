import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { localDataDirectory } from "./paths.js";
export async function localSecrets(env) {
  if (env.ENCRYPTION_KEY) return env;
  if (env.APP_ORIGIN?.startsWith("https:"))
    throw Error("ENCRYPTION_KEY is required for HTTPS");
  const directory = localDataDirectory(),
    keyFile = join(directory, "encryption-key");
  await mkdir(directory, { recursive: true });
  let key;
  try {
    key = (await readFile(keyFile, "utf8")).trim();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    try {
      key = (await readFile(".local/encryption-key", "utf8")).trim();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      key = randomBytes(32).toString("hex");
    }
    await writeFile(keyFile, key, { mode: 0o600, flag: "wx" });
  }
  return { ...env, ENCRYPTION_KEY: key };
}
