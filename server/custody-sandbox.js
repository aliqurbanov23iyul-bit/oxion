// Prepared Fireblocks sandbox boundary. Not connected to public money routes.
import { createHash, createSign, randomUUID } from "node:crypto";
import { fail } from "./core.js";
const root = "https://sandbox-api.fireblocks.io";
const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
export class FireblocksSandbox {
  constructor({ apiKey, privateKey }) {
    this.apiKey = apiKey;
    this.privateKey = privateKey;
  }
  async request(method, path, body) {
    if (!this.apiKey || !this.privateKey) fail(503, "CUSTODY_NOT_CONFIGURED");
    const uri = "/v1" + path;
    const json = body ? JSON.stringify(body) : "";
    const now = Math.floor(Date.now() / 1000);
    const message =
      encode({ alg: "RS256", typ: "JWT" }) +
      "." +
      encode({
        uri,
        nonce: randomUUID(),
        iat: now,
        exp: now + 30,
        sub: this.apiKey,
        bodyHash: createHash("sha256").update(json).digest("hex"),
      });
    const signer = createSign("RSA-SHA256");
    signer.update(message);
    signer.end();
    const jwt = message + "." + signer.sign(this.privateKey, "base64url");
    const response = await fetch(root + uri, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        Authorization: "Bearer " + jwt,
        "Content-Type": "application/json",
      },
      ...(body ? { body: json } : {}),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) fail(503, "CUSTODY_PROVIDER_ERROR");
    return response.json();
  }
  addresses(vaultId, assetId) {
    return this.request(
      "GET",
      `/vault/accounts/${encodeURIComponent(vaultId)}/${encodeURIComponent(assetId)}/addresses_paginated`,
    );
  }
  supportedAssets() {
    return this.request("GET", "/supported_assets");
  }
  transaction(transactionId) {
    return this.request(
      "GET",
      "/transactions/" + encodeURIComponent(transactionId),
    );
  }
  validateAddress(assetId, address) {
    return this.request(
      "GET",
      `/transactions/validate_address/${encodeURIComponent(assetId)}/${encodeURIComponent(address)}`,
    );
  }
  // Must use an explicitly provisioned sandbox asset, never a mainnet asset ID.
  submitTestWithdrawal({ assetId, vaultId, address, amount, externalTxId }) {
    if (!assetId || !externalTxId) fail(400, "INVALID_FORM");
    return this.request("POST", "/transactions", {
      assetId,
      source: { type: "VAULT_ACCOUNT", id: vaultId },
      destination: { type: "ONE_TIME_ADDRESS", oneTimeAddress: { address } },
      amount,
      externalTxId,
    });
  }
}
