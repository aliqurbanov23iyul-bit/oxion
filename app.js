// Vercel's Express entry point. This module never listens on a local port.
import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./server/app.js";
import { database } from "./server/db.js";
import { hostedConfig } from "./server/hosted-config.js";

export function hostedApplication(source = process.env, connect = database) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  // Public documents must render even before Neon/OAuth/SMTP are configured.
  // Use sendFile explicitly: Vercel's Express adapter ignores express.static().
  const publicRoot = fileURLToPath(new URL("./public/", import.meta.url));
  app.use((req, res, next) => {
    if (
      req.path === "/api" ||
      req.path.startsWith("/api/") ||
      req.path === "/admin" ||
      req.path.startsWith("/admin/")
    )
      return next();
    if (!["GET", "HEAD"].includes(req.method)) return res.status(405).end();
    const name = req.path === "/" ? "index.html" : req.path.slice(1);
    const allowed = /^[a-z-]+\.html$/.test(name) || name.startsWith("assets/");
    res
      .status(allowed ? 200 : 404)
      .sendFile(
        allowed ? name : "404.html",
        { root: publicRoot, dotfiles: "deny" },
        (error) => {
          if (error && !res.headersSent)
            res
              .status(error.statusCode === 404 ? 404 : 500)
              .type("text")
              .send("Page unavailable");
        },
      );
  });
  let ready;
  app.use(async (req, res, next) => {
    try {
      // One initialization per warm instance; failed initialization may be retried.
      ready ||= (async () => {
        const env = hostedConfig(source);
        const db = await connect(env.DATABASE_URL, undefined, {
          migrate: false,
        });
        try {
          const version = await db.query(
            "SELECT version FROM oxion_schema WHERE version='2026-10-vercel-1'",
          );
          if (!version.rows.length)
            throw Error("Schema migration is required.");
          return createApp(db, { ...env, HOSTED: "true" });
        } catch (error) {
          await db.close();
          throw error;
        }
      })().catch((error) => {
        ready = undefined;
        throw error;
      });
      (await ready)(req, res, next);
    } catch {
      // Do not expose connection strings or driver errors in responses/logs.
      res
        .status(503)
        .set("Cache-Control", "no-store")
        .json({ error: "SERVICE_NOT_CONFIGURED" });
    }
  });
  return app;
}
export default hostedApplication();
