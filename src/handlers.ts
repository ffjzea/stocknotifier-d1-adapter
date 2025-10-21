import { Env, OrderPayload, AnalysisPayload, json } from './types';

export async function handleGetOrders(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
  return json(resp.results ?? []);
}

export async function handleGetOrderById(env: Env, id: string) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all();
  const row = resp.results?.[0] ?? null;
  return row ? json(row) : new Response(null, { status: 404 });
}

export async function handleGetOpenOrders(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders WHERE terminateTime IS NULL ORDER BY createdAt DESC').all();
  return json(resp.results ?? []);
}

export async function handleCreateOrder(env: Env, payload: OrderPayload) {
  await env.stocknotifier.prepare(
    `INSERT INTO orders (symbol, price, qty, quoteOrderQty, action, traderNo, strategy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      payload.symbol,
      payload.price ?? null,
      payload.qty ?? null,
      payload.quoteOrderQty ?? null,
      payload.action ?? null,
      payload.traderNo ?? null,
      payload.strategy ?? null
    )
    .run();

  const idRes = await env.stocknotifier.prepare("SELECT last_insert_rowid() as id").all();
  const id = idRes.results?.[0]?.id;
  if (id) {
    const row = await env.stocknotifier.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all();
    return json(row.results?.[0] ?? {}, 201);
  }
  return json({}, 201);
}

export async function handleCreateAnalysis(env: Env, payload: AnalysisPayload) {
  const toNumber = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const rsiValue = toNumber(payload.rsiValue);
  const macdValue = toNumber(payload.macdValue);
  const macdSignalValue = toNumber(payload.macdSignalValue);
  // Accept both naming conventions: prefer kdKValue/kdDValue but fall back to kValue/dValue
  const kdKValue = toNumber(payload.kdKValue ?? payload.kValue);
  const kdDValue = toNumber(payload.kdDValue ?? payload.dValue);

  await env.stocknotifier.prepare(
  `INSERT INTO indicator_analysis_records (symbol, analysisTime, rsiStatus, rsiValue, macdStatus, macdValue, macdSignalValue, kdStatus, kdKValue, kdDValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      payload.symbol ?? null,
      payload.analysisTime ?? null,
      payload.rsiStatus ?? null,
      rsiValue,
      payload.macdStatus ?? null,
      macdValue,
      macdSignalValue,
      payload.kdStatus ?? null,
      kdKValue,
      kdDValue
    )
    .run();

  const idRes = await env.stocknotifier.prepare("SELECT last_insert_rowid() as id").all();
  const id = idRes.results?.[0]?.id;
  if (id) {
    const row = await env.stocknotifier.prepare('SELECT * FROM indicator_analysis_records WHERE id = ?').bind(id).all();
    return json(row.results?.[0] ?? {}, 201);
  }
  return json({}, 201);
}

export async function handleGetD1Migrations(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM d1_migrations ORDER BY id').all();
  return json(resp.results ?? []);
}
