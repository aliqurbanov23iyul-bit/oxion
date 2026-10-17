import "dotenv/config";
import { readFile } from "node:fs/promises";
import { FireblocksSandbox } from "../server/custody-sandbox.js";
const env = process.env;
for (const key of [
  "FIREBLOCKS_SANDBOX_API_KEY",
  "FIREBLOCKS_SANDBOX_PRIVATE_KEY_PATH",
  "FIREBLOCKS_SANDBOX_VAULT_ID",
  "FIREBLOCKS_SANDBOX_ASSET_ID",
])
  if (!env[key]) throw Error("Missing configuration: " + key);
const provider = new FireblocksSandbox({
  apiKey: env.FIREBLOCKS_SANDBOX_API_KEY,
  privateKey: await readFile(env.FIREBLOCKS_SANDBOX_PRIVATE_KEY_PATH, "utf8"),
});
const assets = await provider.supportedAssets(),
  asset = assets.find((a) => a.id === env.FIREBLOCKS_SANDBOX_ASSET_ID);
if (!asset)
  throw Error("Configured asset is not supported by the sandbox provider.");
const result = await provider.addresses(
  env.FIREBLOCKS_SANDBOX_VAULT_ID,
  asset.id,
);
console.log(
  JSON.stringify(
    {
      mode: "fireblocks-sandbox",
      warning:
        "Read-only diagnostic. These addresses are NOT linked to an OXION user. No real deposits are accepted.",
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        nativeAsset: asset.nativeAsset,
      },
      addresses: (result.addresses || []).map((a) => ({
        address: a.address,
        memo: a.tag || a.memo || null,
      })),
    },
    null,
    2,
  ),
);
