// Vercel's Express entry point. This module never listens on a local port.
import express from "express";
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
