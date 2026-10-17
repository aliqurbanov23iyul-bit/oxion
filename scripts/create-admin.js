import "dotenv/config";
import { terminal } from "./terminal.js";
import { database } from "../server/db.js";
import { localSecrets } from "../server/config.js";
import { id, passwordHash, vault } from "../server/core.js";
import * as OTPAuth from "otpauth";
const env = await localSecrets(process.env),
  rl = terminal();
console.log(
  "LOCAL ONLY: trusted terminal setup. Use a private terminal; password input is hidden.",
);
const email = (await rl.question("Admin email: ")).trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error("Invalid email");
const password = await passwordHash(
  await rl.secret("Password (12+ characters): "),
);
const secret = new OTPAuth.Secret({ size: 20 });
console.log("Add this secret to your Authenticator: " + secret.base32);
const code = await rl.question("Authenticator code: ");
if (
  new OTPAuth.TOTP({ issuer: "OXION", label: email, secret }).validate({
    token: code,
    window: 1,
  }) === null
)
  throw Error("Invalid TOTP code");
const db = await database(env.DATABASE_URL, env.LOCAL_DATABASE_PATH);
try {
  await db.query(
    "INSERT INTO users(id,uid,email,password,verified,role,totp_secret,totp_enabled) VALUES($1,$2,$3,$4,TRUE,'admin',$5,TRUE)",
    [
      id(),
      "OX-" + (await import("node:crypto")).randomInt(10000000, 100000000),
      email,
      password,
      vault(env.ENCRYPTION_KEY).encrypt(secret.base32),
    ],
  );
} finally {
  await db.close();
  rl.close();
}
console.log(
  "Admin created with mandatory 2FA. Start the server and open /login.html.",
);
