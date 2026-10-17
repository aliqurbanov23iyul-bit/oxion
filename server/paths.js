import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
export function localDataDirectory() {
  const workspace = createHash("sha256")
    .update(resolve(".").toLowerCase())
    .digest("hex")
    .slice(0, 12);
  const base =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
      : join(homedir(), ".local", "share");
  return join(base, "OXION", workspace);
}
