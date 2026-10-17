import {
  saveMethod,
  submitDeposit,
  reviewDeposit,
  depositPrice,
} from "./manual-deposits.js";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { PostgresRateStore } from "./rate-store.js";
import cookies from "cookie-parser";
import nodemailer from "nodemailer";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { OAuth2Client } from "google-auth-library";
import { saveQuote, acceptQuote } from "./quotes.js";
import { queueTestnetOrder, requestTestnetCancel } from "./execution.js";
import { randomInt } from "node:crypto";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import {
  id,
  token,
  hash,
  fail,
  passwordHash,
  passwordCheck,
  vault,
  D,
} from "./core.js";
import {
  markets as publicMarkets,
  marketDetail,
  assets,
  BinanceTestnet,
  networks,
  depositAddress,
} from "./providers.js";
import {
  adjustment,
  withdrawal,
  reviewWithdrawal,
  quoteWithdrawal,
  createOrder,
  fillOrder,
  cancelOrder,
} from "./finance.js";
export function createApp(db, env = process.env, services = {}) {
  const markets = services.markets || publicMarkets;
  const testnet =
    env.ENABLE_BINANCE_TESTNET === "true" &&
    env.DATABASE_URL &&
    env.BINANCE_TESTNET_API_KEY &&
    env.BINANCE_TESTNET_API_SECRET
      ? new BinanceTestnet(
          env.BINANCE_TESTNET_API_KEY,
          env.BINANCE_TESTNET_API_SECRET,
        )
      : null;
  const app = express(),
    origin = env.APP_ORIGIN || "http://localhost:4317",
    secure = origin.startsWith("https:"),
    crypto = vault(env.ENCRYPTION_KEY);
  const mailer = env.SMTP_HOST
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT || 587),
        secure: Number(env.SMTP_PORT) === 465,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
      })
    : null;
  app.disable("x-powered-by");
  if (env.HOSTED === "true") {
    // Vercel's edge overwrites x-real-ip. Never trust arbitrary forwarded-for chains.
    app.use((req, res, next) => {
      const ip = req.headers["x-real-ip"];
      if (typeof ip === "string" && isIP(ip))
        Object.defineProperty(req, "ip", { value: ip, configurable: true });
      next();
    });
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "style-src": ["'self'"],
          "style-src-attr": ["'unsafe-inline'"],
          "upgrade-insecure-requests": secure ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "200kb" }), cookies());
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      message: { error: "RATE_LIMITED" },
      standardHeaders: "draft-8",
      legacyHeaders: false,
      ...(env.HOSTED === "true"
        ? {
            store: new PostgresRateStore(db, "api"),
            validate: { xForwardedForHeader: false },
          }
        : {}),
    }),
  );
  app.use(["/api", "/admin"], async (req, res, next) => {
    try {
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        req.headers.origin !== origin
      )
        fail(403, "ORIGIN_DENIED");
      if (req.cookies.sid) {
        const s = (
          await db.query(
            "SELECT s.*,u.uid,u.email,coalesce(to_jsonb(u)->>'display_name','') AS display_name,u.role,u.verified,u.language,u.totp_enabled,u.totp_secret FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=$1 AND s.expires_at>now()",
            [hash(req.cookies.sid)],
          )
        ).rows[0];
        if (s) {
          req.auth = s;
          if (
            !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
            req.headers["x-csrf-token"] !== s.csrf
          )
            fail(403, "CSRF_DENIED");
        }
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  const auth = (req, res, next) =>
    req.auth
      ? next()
      : next(
          Object.assign(Error("AUTH_REQUIRED"), {
            status: 401,
            code: "AUTH_REQUIRED",
          }),
        );
  const verified = (req, res, next) =>
    req.auth?.verified
      ? next()
      : next(
          Object.assign(Error("EMAIL_NOT_VERIFIED"), {
            status: 403,
            code: "EMAIL_NOT_VERIFIED",
          }),
        );
  const admin = (req, res, next) =>
    req.auth?.role === "admin" && req.auth.totp_enabled
      ? next()
      : next(
          Object.assign(Error("ADMIN_2FA_REQUIRED"), {
            status: 403,
            code: "ADMIN_2FA_REQUIRED",
          }),
        );
  const key = (req) => {
    const k = req.headers["idempotency-key"];
    if (typeof k !== "string" || !/^[a-zA-Z0-9-]{8,100}$/.test(k))
      fail(400, "IDEMPOTENCY_KEY_REQUIRED");
    return k;
  };
  const totp = (u, code) => {
    if (!u.totp_enabled) return false;
    try {
      return (
        new OTPAuth.TOTP({
          issuer: "OXION",
          label: u.email,
          secret: OTPAuth.Secret.fromBase32(crypto.decrypt(u.totp_secret)),
          digits: 6,
          period: 30,
        }).validate({ token: String(code || ""), window: 1 }) !== null
      );
    } catch {
      return false;
    }
  };
  async function session(req, res, u) {
    const raw = token(),
      csrf = token();
    await db.transaction(async (tx) => {
      const current = (
        await tx.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [u.id])
      ).rows[0];
      if (!current || (u.password && current.password !== u.password))
        fail(401, "INVALID_CREDENTIALS");
      if (
        (current.totp_enabled || current.role === "admin") &&
        !totp(current, req.body?.code)
      )
        fail(403, "TOTP_REQUIRED");
      if (u.password && !u.password.startsWith("scrypt:131072:8:1:"))
        await tx.query("UPDATE users SET password=$1 WHERE id=$2", [
          await passwordHash(req.body.password),
          u.id,
        ]);
      await tx.query(
        "INSERT INTO sessions(hash,user_id,csrf,expires_at,ip,agent) VALUES($1,$2,$3,now()+interval '12 hours',$4,$5)",
        [
          hash(raw),
          u.id,
          csrf,
          req.ip,
          (req.headers["user-agent"] || "").slice(0, 300),
        ],
      );
      await tx.query(
        "INSERT INTO login_history(id,user_id,ip,agent) VALUES($1,$2,$3,$4)",
        [id(), u.id, req.ip, (req.headers["user-agent"] || "").slice(0, 300)],
      );
    });
    res.cookie("sid", raw, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: 43200000,
      path: "/",
    });
    return csrf;
  }
  async function sendToken(u, purpose) {
    const raw = token();
    await db.query(
      "INSERT INTO tokens(hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
      [hash(raw), u.id, purpose],
    );
    const url =
      origin +
      (purpose === "verify" ? "/verify-email.html" : "/forgot-password.html") +
      "?token=" +
      raw;
    const label =
      purpose === "verify" ? "Hesabınızı təsdiqləyin" : "Şifrənizi yeniləyin";
    const html = `<h1>OXION</h1><p>Link 30 dəqiqə etibarlıdır.</p><a href="${url}">${label}</a>`;
    if (mailer)
      await mailer.sendMail({
        from: env.MAIL_FROM,
        to: u.email,
        subject: label,
        text: `${label}: ${url}\nLink 30 dəqiqə ərzində bir dəfə istifadə oluna bilər.`,
        html,
      });
    else if (!secure) {
      await mkdir(".local/mail", { recursive: true });
      await writeFile(
        `.local/mail/${Date.now()}-${id()}.html`,
        `<!-- LOCAL PREVIEW ONLY. NOT SENT. To: ${u.email} -->\n${html}`,
        { mode: 0o600 },
      );
    }
    return mailer ? "smtp" : "not-configured";
  }
  const loginLimit = rateLimit({
    windowMs: 900000,
    limit: 20,
    message: { error: "RATE_LIMITED" },
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(env.HOSTED === "true"
      ? {
          store: new PostgresRateStore(db, "login"),
          validate: { xForwardedForHeader: false },
        }
      : {}),
  });
  app.get("/api/status", (req, res) =>
    res.json({
      mode: env.HOSTED === "true" ? "hosted-simulation" : "local-simulation",
      database: db.kind,
      execution: "local simulation; no exchange settlement",
      custody: false,
      email: !!mailer,
      google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      liveMoney: false,
      networks,
      assets,
      social: {
        instagram: env.INSTAGRAM_URL || null,
        tiktok: env.TIKTOK_URL || null,
        telegram: env.TELEGRAM_URL || null,
      },
    }),
  );
  app.get("/api/me", (req, res) =>
    res.json(
      req.auth
        ? {
            user: {
              id: req.auth.user_id,
              uid: req.auth.uid,
              email: req.auth.email,
              display_name: req.auth.display_name,
              role: req.auth.role,
              verified: req.auth.verified,
              language: req.auth.language,
              totp: req.auth.totp_enabled,
            },
            csrf: req.auth.csrf,
          }
        : { user: null },
    ),
  );
  app.post("/api/auth/signup", loginLimit, async (req, res) => {
    if (req.body.terms !== true && req.body.terms !== "on")
      fail(400, "TERMS_REQUIRED");
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254)
      fail(400, "INVALID_EMAIL");
    const pw = await passwordHash(req.body.password);
    const u = { id: id(), email };
    await db.query(
      "INSERT INTO users(id,uid,email,password) VALUES($1,$2,$3,$4)",
      [u.id, "OX-" + randomInt(10000000, 100000000), email, pw],
    );
    const delivery = await sendToken(u, "verify");
    res.status(201).json({ status: "verification_required", delivery });
  });
  app.post("/api/auth/login", loginLimit, async (req, res) => {
    const u = (
      await db.query("SELECT * FROM users WHERE email=$1", [
        String(req.body.email || "")
          .toLowerCase()
          .trim(),
      ])
    ).rows[0];
    if (!u || !(await passwordCheck(req.body.password, u.password)))
      fail(401, "INVALID_CREDENTIALS");
    if ((u.totp_enabled || u.role === "admin") && !totp(u, req.body.code))
      fail(403, "TOTP_REQUIRED");
    const csrf = await session(req, res, u);
    res.json({ csrf });
  });
  app.post("/api/auth/logout", auth, async (req, res) => {
    await db.query("DELETE FROM sessions WHERE hash=$1", [req.auth.hash]);
    res.clearCookie("sid", { path: "/" }).json({ status: "ok" });
  });
  app.post("/api/auth/verify", async (req, res) => {
    await db.transaction(async (tx) => {
      const t = (
        await tx.query(
          "SELECT * FROM tokens WHERE hash=$1 AND purpose='verify' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
          [hash(String(req.body.token || ""))],
        )
      ).rows[0];
      if (!t) fail(400, "TOKEN_INVALID");
      await tx.query("UPDATE tokens SET used_at=now() WHERE hash=$1", [t.hash]);
      await tx.query("UPDATE users SET verified=TRUE WHERE id=$1", [t.user_id]);
    });
    res.json({ status: "verified" });
  });
  app.post("/api/auth/resend", auth, loginLimit, async (req, res) => {
    res.json({
      delivery: await sendToken(
        { id: req.auth.user_id, email: req.auth.email },
        "verify",
      ),
    });
  });
  app.post("/api/auth/forgot", loginLimit, async (req, res) => {
    const u = (
      await db.query("SELECT * FROM users WHERE email=$1", [
        String(req.body.email || "")
          .trim()
          .toLowerCase(),
      ])
    ).rows[0];
    if (u) await sendToken(u, "reset");
    res.json({
      status: "if_account_exists",
      delivery: mailer ? "smtp" : "not-configured",
    });
  });
  app.post("/api/auth/reset", loginLimit, async (req, res) => {
    const pw = await passwordHash(req.body.password);
    await db.transaction(async (tx) => {
      const t = (
        await tx.query(
          "SELECT * FROM tokens WHERE hash=$1 AND purpose='reset' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
          [hash(String(req.body.token || ""))],
        )
      ).rows[0];
      if (!t) fail(400, "TOKEN_INVALID");
      await tx.query("UPDATE users SET password=$1 WHERE id=$2", [
        pw,
        t.user_id,
      ]);
      await tx.query(
        "UPDATE tokens SET used_at=now() WHERE user_id=$1 AND purpose='reset' AND used_at IS NULL",
        [t.user_id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
    });
    res.json({ status: "ok" });
  });
  app.get("/api/auth/google", async (req, res) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET)
      fail(503, "GOOGLE_NOT_CONFIGURED");
    const state = token();
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 300000,
      path: "/api/auth/google",
    });
    const client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI || origin + "/api/auth/google/callback",
    );
    res.redirect(
      client.generateAuthUrl({
        scope: ["openid", "email"],
        state,
        prompt: "select_account",
      }),
    );
  });
  app.get("/api/auth/google/callback", async (req, res) => {
    if (req.query.error) fail(400, "GOOGLE_CANCELLED");
    if (!req.cookies.oauth_state || req.query.state !== req.cookies.oauth_state)
      fail(403, "OAUTH_STATE_INVALID");
    res.clearCookie("oauth_state", { path: "/api/auth/google" });
    const client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI || origin + "/api/auth/google/callback",
    );
    const { tokens } = await client.getToken(String(req.query.code));
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p.email_verified) fail(403, "EMAIL_NOT_VERIFIED");
    let u = (await db.query("SELECT * FROM users WHERE google_sub=$1", [p.sub]))
      .rows[0];
    if (!u) {
      if (
        (
          await db.query("SELECT id FROM users WHERE email=$1", [
            p.email.toLowerCase(),
          ])
        ).rows.length
      )
        fail(409, "GOOGLE_ACCOUNT_LINK_REQUIRED");
      u = { id: id(), email: p.email.toLowerCase() };
      await db.query(
        "INSERT INTO users(id,uid,email,verified,google_sub) VALUES($1,$2,$3,TRUE,$4)",
        [u.id, "OX-" + randomInt(10000000, 100000000), u.email, p.sub],
      );
    }
    if (u.totp_enabled || u.role === "admin") {
      const raw = token();
      await db.query(
        "INSERT INTO tokens(hash,user_id,purpose,expires_at) VALUES($1,$2,'google_login',now()+interval '5 minutes')",
        [hash(raw), u.id],
      );
      res.cookie("oauth_challenge", raw, {
        httpOnly: true,
        secure,
        sameSite: "strict",
        maxAge: 300000,
        path: "/api/auth/google/complete",
      });
      return res.redirect("/login.html?google=totp");
    }
    await session(req, res, u);
    res.redirect("/profile.html");
  });
  app.post("/api/auth/google/complete", loginLimit, async (req, res) => {
    let user;
    await db.transaction(async (tx) => {
      const challenge = (
        await tx.query(
          "SELECT * FROM tokens WHERE hash=$1 AND purpose='google_login' AND used_at IS NULL AND expires_at>now() FOR UPDATE",
          [hash(req.cookies.oauth_challenge || "")],
        )
      ).rows[0];
      if (!challenge) fail(400, "TOKEN_INVALID");
      user = (
        await tx.query("SELECT * FROM users WHERE id=$1", [challenge.user_id])
      ).rows[0];
      if (!totp(user, req.body.code)) fail(403, "TOTP_REQUIRED");
      await tx.query("UPDATE tokens SET used_at=now() WHERE hash=$1", [
        challenge.hash,
      ]);
    });
    res.clearCookie("oauth_challenge", { path: "/api/auth/google/complete" });
    res.json({ csrf: await session(req, res, user) });
  });
  app.get("/api/security", auth, async (req, res) => {
    const [sessions, history] = await Promise.all([
      db.query(
        "SELECT hash,created_at,expires_at,ip,agent FROM sessions WHERE user_id=$1 AND expires_at>now()",
        [req.auth.user_id],
      ),
      db.query(
        "SELECT ip,agent,created_at FROM login_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
        [req.auth.user_id],
      ),
    ]);
    res.json({
      sessions: sessions.rows.map((s) => ({
        ...s,
        current: s.hash === req.auth.hash,
      })),
      history: history.rows,
    });
  });
  app.delete("/api/security/sessions/:hash", auth, async (req, res) => {
    await db.query("DELETE FROM sessions WHERE hash=$1 AND user_id=$2", [
      req.params.hash,
      req.auth.user_id,
    ]);
    res.json({ status: "ok" });
  });
  app.post("/api/security/totp/setup", auth, async (req, res) => {
    if (req.auth.totp_enabled) fail(409, "ALREADY_ENABLED");
    const secret = new OTPAuth.Secret({ size: 20 });
    await db.query("UPDATE users SET totp_secret=$1 WHERE id=$2", [
      crypto.encrypt(secret.base32),
      req.auth.user_id,
    ]);
    const uri = new OTPAuth.TOTP({
      issuer: "OXION",
      label: req.auth.email,
      secret,
    }).toString();
    res.json({ secret: secret.base32, qr: await QRCode.toDataURL(uri) });
  });
  app.post("/api/security/totp/enable", auth, async (req, res) => {
    if (
      !req.auth.totp_secret ||
      !totp({ ...req.auth, totp_enabled: true }, req.body.code)
    )
      fail(400, "INVALID_TOTP");
    await db.query("UPDATE users SET totp_enabled=TRUE WHERE id=$1", [
      req.auth.user_id,
    ]);
    await db.query("DELETE FROM sessions WHERE user_id=$1 AND hash<>$2", [
      req.auth.user_id,
      req.auth.hash,
    ]);
    res.json({ status: "ok" });
  });
  app.patch("/api/profile", auth, async (req, res) => {
    if (!["az", "en", "tr", "ru"].includes(req.body.language))
      fail(400, "INVALID_LANGUAGE");
    const name =
      req.body.display_name === undefined
        ? req.auth.display_name
        : req.body.display_name;
    if (
      typeof name !== "string" ||
      name.trim().length > 60 ||
      /[\u0000-\u001f<>]/.test(name)
    )
      fail(400, "INVALID_FORM");
    await db.query("UPDATE users SET language=$1,display_name=$2 WHERE id=$3", [
      req.body.language,
      name.trim(),
      req.auth.user_id,
    ]);
    res.json({ status: "ok" });
  });
  app.get("/api/markets", async (req, res) =>
    res.json({
      items: await markets(),
      source: "Binance public API",
      at: new Date().toISOString(),
    }),
  );
  app.get("/api/markets/:symbol", async (req, res) =>
    res.json(await marketDetail(req.params.symbol, req.query.interval)),
  );
  app.get("/api/wallet", auth, async (req, res) =>
    res.json({
      totals: (
        await db.query(
          "SELECT asset,SUM(balance)::text AS balance FROM accounts WHERE user_id=$1 GROUP BY asset",
          [req.auth.user_id],
        )
      ).rows,
      items: (
        await db.query(
          "SELECT asset,bucket,balance FROM accounts WHERE user_id=$1 ORDER BY asset,bucket",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.get("/api/history", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT j.id,j.kind,j.reason,j.created_at,a.asset,a.bucket,e.amount,e.before_balance,e.after_balance FROM entries e JOIN journals j ON j.id=e.journal_id JOIN accounts a ON a.id=e.account_id WHERE a.user_id=$1 ORDER BY j.created_at DESC LIMIT 100",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.get("/api/deposits", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT * FROM deposits WHERE user_id=$1 ORDER BY created_at DESC",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.post("/api/deposit/address", auth, verified, (req, res) =>
    res.json(depositAddress()),
  );
  app.get("/api/deposit/methods/:id/qr", auth, async (req, res) => {
    const m = (
      await db.query(
        "SELECT address,qr_image FROM deposit_methods WHERE id=$1 AND active=TRUE",
        [req.params.id],
      )
    ).rows[0];
    if (!m) fail(404, "NOT_FOUND");
    if (m.qr_image) {
      const [header, data] = m.qr_image.split(",");
      return res
        .type(header.includes("png") ? "png" : "jpeg")
        .send(Buffer.from(data, "base64"));
    }
    res.type("svg").send(
      await QRCode.toString(m.address, {
        type: "svg",
        margin: 2,
        width: 200,
      }),
    );
  });
  app.get("/api/deposit/methods", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT id,asset,network,address,memo,minimum,minimum_usd,confirmations FROM deposit_methods WHERE active=TRUE ORDER BY created_at",
        )
      ).rows,
    }),
  );
  app.get("/api/deposit/methods/:id/minimum", auth, async (req, res) => {
    const m = (
      await db.query(
        "SELECT asset,minimum_usd FROM deposit_methods WHERE id=$1 AND active=TRUE",
        [req.params.id],
      )
    ).rows[0];
    if (!m) fail(404, "NOT_FOUND");
    const price = await depositPrice(m.asset, markets);
    res.json({
      asset: m.asset,
      minimum_usd: m.minimum_usd,
      minimum_amount: new D(m.minimum_usd)
        .div(price)
        .toDecimalPlaces(18, D.ROUND_UP)
        .toFixed(18),
      price: price.toFixed(18),
      quoted_at: new Date().toISOString(),
    });
  });
  app.post("/api/deposit/requests", auth, verified, async (req, res) =>
    res
      .status(201)
      .json(await submitDeposit(db, req.auth.user_id, req.body, markets)),
  );
  app.get("/api/deposit/requests", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT d.*,CASE WHEN r.approved=TRUE THEN 'confirmed' WHEN r.approved=FALSE THEN 'rejected' ELSE 'awaiting_review' END AS status,r.reason FROM deposit_requests d LEFT JOIN deposit_reviews r ON r.request_id=d.id WHERE d.user_id=$1 ORDER BY d.created_at DESC LIMIT 100",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.get("/api/withdrawals", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT * FROM withdrawals WHERE user_id=$1 ORDER BY created_at DESC",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.post("/api/withdrawals/quote", auth, verified, (req, res) =>
    res.json(quoteWithdrawal(req.body)),
  );
  app.post("/api/withdrawals", auth, verified, async (req, res) => {
    if (!totp(req.auth, req.body.code)) fail(403, "TOTP_REQUIRED");
    res.json(await withdrawal(db, req.auth.user_id, req.body, key(req)));
  });
  app.get("/api/orders", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.post("/api/orders/quote", auth, verified, async (req, res) =>
    res.json(
      await saveQuote(
        db,
        req.auth.user_id,
        req.body,
        await markets(),
        key(req),
      ),
    ),
  );
  app.post("/api/orders", auth, verified, async (req, res) => {
    key(req);
    if (typeof req.body.quote_id !== "string") fail(400, "QUOTE_REQUIRED");
    res.json(
      await acceptQuote(
        db,
        req.auth.user_id,
        req.body.quote_id,
        await markets(),
      ),
    );
  });
  app.delete("/api/orders/:id", auth, async (req, res) => {
    const order = (
      await db.query(
        "SELECT execution_mode FROM orders WHERE id=$1 AND user_id=$2",
        [req.params.id, req.auth.user_id],
      )
    ).rows[0];
    if (!order) fail(404, "NOT_FOUND");
    res.json(
      order.execution_mode === "binance-testnet"
        ? await requestTestnetCancel(db, req.auth.user_id, req.params.id)
        : await cancelOrder(db, req.auth.user_id, req.params.id),
    );
  });
  app.get("/api/campaigns", async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT * FROM campaigns WHERE active=TRUE AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now()) ORDER BY sort_order,id",
        )
      ).rows,
    }),
  );
  app.get("/api/campaigns/preview", async (req, res) =>
    res.json({
      mode: "inactive-design-preview",
      item:
        (
          await db.query(
            "SELECT * FROM campaigns WHERE id='first-deposit' AND active=FALSE",
          )
        ).rows[0] || null,
    }),
  );
  app.get("/api/tickets", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT * FROM tickets WHERE user_id=$1 ORDER BY created_at DESC",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.post("/api/tickets", auth, async (req, res) => {
    const categories = [
      "account",
      "google",
      "deposit",
      "withdraw",
      "trade",
      "security",
    ];
    if (!categories.includes(req.body.category)) fail(400, "INVALID_FORM");
    if (
      typeof req.body.subject !== "string" ||
      req.body.subject.trim().length < 4 ||
      typeof req.body.message !== "string" ||
      req.body.message.trim().length < 10
    )
      fail(400, "INVALID_FORM");
    const ticketId = id();
    await db.query(
      "INSERT INTO tickets(id,user_id,subject,message,category) VALUES($1,$2,$3,$4,$5)",
      [
        ticketId,
        req.auth.user_id,
        req.body.subject.slice(0, 150),
        req.body.message.slice(0, 5000),
        req.body.category,
      ],
    );
    res.status(201).json({ id: ticketId, status: "open" });
  });
  app.use("/api/admin", auth, admin);
  app.get("/api/admin/deposit-methods", async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT id,asset,network,address,memo,minimum,minimum_usd,confirmations,active,created_at,(qr_image IS NOT NULL) AS custom_qr FROM deposit_methods ORDER BY created_at DESC",
        )
      ).rows,
    }),
  );
  app.post("/api/admin/deposit-methods", async (req, res) =>
    res.status(201).json(await saveMethod(db, req.auth.user_id, req.body)),
  );
  app.patch("/api/admin/deposit-methods/:id", async (req, res) => {
    if (typeof req.body.active !== "boolean") fail(400, "INVALID_FORM");
    const r = await db.query(
      "UPDATE deposit_methods SET active=$1 WHERE id=$2 RETURNING id",
      [req.body.active, req.params.id],
    );
    if (!r.rows.length) fail(404, "NOT_FOUND");
    res.json(r.rows[0]);
  });
  app.get("/api/admin/deposit-requests", async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT d.*,u.uid,u.email,CASE WHEN r.approved=TRUE THEN 'confirmed' WHEN r.approved=FALSE THEN 'rejected' ELSE 'awaiting_review' END AS status FROM deposit_requests d JOIN users u ON u.id=d.user_id LEFT JOIN deposit_reviews r ON r.request_id=d.id ORDER BY d.created_at DESC LIMIT 100",
        )
      ).rows,
    }),
  );
  app.post("/api/admin/deposit-requests/:id/review", async (req, res) =>
    res.json(
      await reviewDeposit(db, req.auth.user_id, req.params.id, req.body),
    ),
  );
  app.get("/api/admin/testnet", async (req, res) =>
    res.json({
      configured: !!testnet,
      mainnet: false,
      items: (
        await db.query(
          "SELECT j.*,o.symbol,o.quantity,o.filled,o.status FROM execution_jobs j JOIN orders o ON o.id=j.order_id ORDER BY j.created_at DESC LIMIT 100",
        )
      ).rows,
    }),
  );
  app.post("/api/admin/testnet/orders", async (req, res) => {
    if (!testnet) fail(503, "TESTNET_NOT_CONFIGURED");
    res.json(
      await queueTestnetOrder(
        db,
        req.auth.user_id,
        req.body,
        key(req),
        await testnet.markets(),
      ),
    );
  });
  app.get("/api/admin/users", async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT id,uid,email,verified,role,created_at FROM users WHERE uid ILIKE $1 OR email ILIKE $1 ORDER BY created_at DESC LIMIT 50",
          ["%" + String(req.query.q || "").slice(0, 100) + "%"],
        )
      ).rows,
    }),
  );
  app.post("/api/admin/adjustments", async (req, res) =>
    res.json({
      id: await adjustment(
        db,
        req.auth.user_id,
        req.body.user,
        req.body.asset,
        req.body.amount,
        req.body.reason,
        key(req),
      ),
    }),
  );
  app.get("/api/admin/overview", async (req, res) => {
    const [deposits, withdrawals, tickets, campaigns, audit, orders] =
      await Promise.all(
        [
          "SELECT * FROM deposits ORDER BY created_at DESC LIMIT 100",
          "SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 100",
          "SELECT * FROM tickets ORDER BY created_at DESC LIMIT 100",
          "SELECT * FROM campaigns ORDER BY sort_order",
          "SELECT j.*,e.amount,e.before_balance,e.after_balance,a.asset,a.user_id FROM journals j JOIN entries e ON e.journal_id=j.id JOIN accounts a ON a.id=e.account_id WHERE a.user_id IS NOT NULL ORDER BY j.created_at DESC LIMIT 100",
          "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100",
        ].map((s) => db.query(s)),
      );
    res.json({
      deposits: deposits.rows,
      withdrawals: withdrawals.rows,
      tickets: tickets.rows,
      campaigns: campaigns.rows,
      audit: audit.rows,
      orders: orders.rows,
    });
  });
  app.post("/api/admin/withdrawals/:id/review", async (req, res) =>
    res.json(
      await reviewWithdrawal(
        db,
        req.auth.user_id,
        req.params.id,
        req.body.approve === true,
      ),
    ),
  );
  app.post("/api/admin/orders/:id/simulate-fill", async (req, res) =>
    res.json(
      await fillOrder(
        db,
        req.params.id,
        req.body.quantity,
        req.body.price,
        key(req),
      ),
    ),
  );
  app.patch("/api/admin/tickets/:id", async (req, res) => {
    if (typeof req.body.reply !== "string" || req.body.reply.trim().length < 3)
      fail(400, "INVALID_FORM");
    await db.query(
      "UPDATE tickets SET reply=$1,status='answered' WHERE id=$2",
      [req.body.reply.slice(0, 5000), req.params.id],
    );
    res.json({ status: "ok" });
  });
  app.put("/api/admin/campaigns/:id", async (req, res) => {
    const b = req.body;
    const campaign = (
      await db.query("SELECT kind FROM campaigns WHERE id=$1", [req.params.id])
    ).rows[0];
    if (!campaign) fail(404, "NOT_FOUND");
    if (b.active && campaign.kind !== "informational")
      fail(409, "CAMPAIGN_ACTIVATION_BLOCKED");
    if (
      !b.texts ||
      !["az", "en", "tr", "ru"].every(
        (l) => typeof b.texts[l]?.title === "string",
      )
    )
      fail(400, "ALL_TRANSLATIONS_REQUIRED");
    if (
      !String(b.link || "").startsWith("/") ||
      String(b.link).startsWith("//")
    )
      fail(400, "INVALID_LINK");
    if (b.image && !/^\/assets\/[\w./-]+$/.test(b.image))
      fail(400, "INVALID_IMAGE");
    await db.query(
      "UPDATE campaigns SET active=$9,sort_order=$1,starts_at=$2,ends_at=$3,image=$4,link=$5,texts=$6,terms=$7 WHERE id=$8",
      [
        Number(b.sort_order) || 0,
        b.starts_at || null,
        b.ends_at || null,
        b.image || null,
        b.link,
        JSON.stringify(b.texts),
        JSON.stringify(b.terms || {}),
        req.params.id,
        b.active === true,
      ],
    );
    res.json({ status: "saved", active: b.active === true });
  });
  app.get(["/admin", "/admin/{*path}"], auth, admin, (req, res) =>
    res
      .set("Cache-Control", "no-store")
      .sendFile(resolve("server/views/admin.html")),
  );
  app.use("/admin", auth, admin);
  app.use(
    express.static(resolve("public"), {
      index: "index.html",
      dotfiles: "deny",
    }),
  );
  app.use("/api", (req, res) => res.status(404).json({ error: "NOT_FOUND" }));
  app.use((req, res) => res.status(404).sendFile(resolve("public/404.html")));
  app.use((e, req, res, next) => {
    const code =
      e.code === "23505" ? "ALREADY_EXISTS" : e.code || "INTERNAL_ERROR";
    if (req.path === "/api/auth/google/callback")
      return res.redirect(
        "/login.html?oauth_error=" + encodeURIComponent(code),
      );
    if (!e.status && e.code !== "23505")
      console.error("OXION request failed", e.code || "INTERNAL_ERROR");
    res
      .status(e.status || (e.code === "23505" ? 409 : 500))
      .json({ error: code });
  });
  return app;
}
