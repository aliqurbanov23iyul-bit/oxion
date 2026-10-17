import {
  demoAssets,
  demoSettings,
  demoFeed,
  ensureDemo,
  openDemo,
  settleDue,
  updateDemoSettings,
} from "./directional.js";
import { fail } from "./core.js";
const safe = (v) =>
  JSON.parse(
    JSON.stringify(v, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
  );
export function directionalRoutes(app, db, { auth, verified, admin, key }) {
  app.get("/api/demo/market", async (req, res) => {
    const asset = String(req.query.asset || "XAUUSD");
    if (!demoAssets.some((a) => a.symbol === asset))
      fail(400, "UNSUPPORTED_PAIR");
    const now = Date.now(),
      [assets, settings, ticks] = await Promise.all([
        demoFeed(db, now),
        demoSettings(db),
        db.query(
          "SELECT at_ms,received_ms,price FROM demo_ticks WHERE asset=$1 ORDER BY at_ms DESC LIMIT 1200",
          [asset],
        ),
      ]);
    res.json(
      safe({
        server_ms: now,
        source: "simulation-v1",
        simulated: true,
        assets,
        settings: {
          id: settings.id,
          payout: settings.payout,
          minimum: settings.minimum,
          maximum: settings.maximum,
        },
        series: ticks.rows.reverse(),
        real_money: false,
        rounding: "profit: 2 decimals, ROUND_DOWN",
        close_rule: "first valid tick at/after expiry; maximum delay 1500ms",
      }),
    );
  });
  app.get("/api/demo/account", auth, async (req, res) => {
    await settleDue(db, Date.now(), req.auth.user_id);
    const balances = await ensureDemo(db, req.auth.user_id);
    res.json({
      mode: "demo",
      currency: "DEMO-USD",
      virtual: true,
      available:
        balances.find((a) => a.bucket === "available")?.balance || "0.00",
      reserved:
        balances.find((a) => a.bucket === "reserved")?.balance || "0.00",
    });
  });
  app.get("/api/demo/positions", auth, async (req, res) => {
    await settleDue(db, Date.now(), req.auth.user_id);
    const rows = await db.query(
      "SELECT p.*,coalesce(r.status,'open') AS status,r.close_price,r.close_tick_ms,r.close_received_ms,r.credit,r.profit,r.reason,r.settled_ms FROM demo_positions p LEFT JOIN demo_results r ON r.position_id=p.id WHERE p.user_id=$1 ORDER BY p.opened_ms DESC LIMIT 200",
      [req.auth.user_id],
    );
    res.json(safe({ server_ms: Date.now(), items: rows.rows }));
  });
  app.post("/api/demo/positions", auth, verified, async (req, res) =>
    res
      .status(201)
      .json(safe(await openDemo(db, req.auth.user_id, req.body, key(req)))),
  );
  app.get("/api/demo/ledger", auth, async (req, res) =>
    res.json({
      items: (
        await db.query(
          "SELECT j.*,e.amount,e.before_balance,e.after_balance,a.bucket FROM demo_journals j JOIN demo_entries e ON e.journal_id=j.id JOIN demo_accounts a ON a.id=e.account_id WHERE a.user_id=$1 ORDER BY j.created_at DESC LIMIT 200",
          [req.auth.user_id],
        )
      ).rows,
    }),
  );
  app.get("/api/admin/demo", auth, admin, async (req, res) => {
    const [settings, assets, positions, ledger, versions] = await Promise.all([
      demoSettings(db),
      demoFeed(db),
      db.query(
        "SELECT p.*,coalesce(r.status,'open') AS status,r.close_price,r.credit,r.profit FROM demo_positions p LEFT JOIN demo_results r ON r.position_id=p.id ORDER BY p.opened_ms DESC LIMIT 200",
      ),
      db.query(
        "SELECT j.*,e.amount,e.before_balance,e.after_balance,a.user_id,a.bucket,u.uid FROM demo_journals j JOIN demo_entries e ON e.journal_id=j.id JOIN demo_accounts a ON a.id=e.account_id LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id IS NOT NULL ORDER BY j.created_at DESC LIMIT 100",
      ),
      db.query("SELECT * FROM demo_settings ORDER BY version DESC LIMIT 50"),
    ]);
    res.json(
      safe({
        settings,
        assets,
        positions: positions.rows,
        ledger: ledger.rows,
        versions: versions.rows,
        real_money: false,
      }),
    );
  });
  app.post("/api/admin/demo/settings", auth, admin, async (req, res) =>
    res
      .status(201)
      .json(await updateDemoSettings(db, req.auth.user_id, req.body)),
  );
}
