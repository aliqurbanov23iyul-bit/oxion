export function hostedConfig(source) {
  const env = { ...source };
  if (!env.DATABASE_URL)
    throw Error("DATABASE_URL is required; connect Neon in Vercel Storage.");
  const database = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(database.protocol))
    throw Error("DATABASE_URL must be PostgreSQL.");
  if (
    !["require", "verify-ca", "verify-full"].includes(
      database.searchParams.get("sslmode"),
    )
  )
    throw Error("DATABASE_URL must require SSL. Keep the Neon SSL parameters.");
  if (!/^[a-f0-9]{64}$/i.test(env.ENCRYPTION_KEY || ""))
    throw Error("ENCRYPTION_KEY must contain 64 hexadecimal characters.");
  const origin = new URL(env.APP_ORIGIN || "");
  if (
    origin.protocol !== "https:" ||
    origin.origin !== env.APP_ORIGIN ||
    origin.username ||
    origin.password
  )
    throw Error(
      "APP_ORIGIN must be the exact HTTPS origin without a trailing slash.",
    );
  if (env.ENABLE_BINANCE_TESTNET === "true")
    throw Error("The Vercel web app does not run the separate Testnet worker.");
  if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET)
    throw Error("Configure both Google OAuth credentials, or neither.");
  if (
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_REDIRECT_URI !== env.APP_ORIGIN + "/api/auth/google/callback"
  )
    throw Error(
      "GOOGLE_REDIRECT_URI must match APP_ORIGIN + /api/auth/google/callback.",
    );
  if (
    env.SMTP_HOST &&
    (!env.MAIL_FROM ||
      !env.SMTP_USER ||
      !env.SMTP_PASSWORD ||
      !["465", "587"].includes(env.SMTP_PORT))
  )
    throw Error(
      "SMTP requires MAIL_FROM, SMTP_USER, SMTP_PASSWORD and SMTP_PORT (465 or 587).",
    );
  return env;
}
