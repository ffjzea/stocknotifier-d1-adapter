export interface Env {
  stocknotifier: D1Database; // bound in wrangler.toml
}

interface OrderPayload {
  symbol: string;
  price?: number; // corresponds to double price in Java
  qty?: number | null;
  quoteOrderQty?: number | null;
  action?: string | null;
  createdAt?: string | null; // ISO timestamp for LocalDateTime
  traderNo?: string | null;
  strategy?: string | null;
  terminateTime?: string | null; // ISO timestamp for LocalDateTime
  terminatePrice?: number | null;
}

interface AnalysisPayload {
  symbol?: string;
  analysisTime?: string | null; // ISO timestamp matching LocalDateTime
  rsiStatus?: string | null;
  rsiValue?: number | null;
  macdStatus?: string | null;
  macdValue?: number | null;
  macdSignalValue?: number | null;
  kdStatus?: string | null;
  kValue?: number | null;
  dValue?: number | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGetOrders(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders ORDER BY createdAt DESC').all();
  return json(resp.results ?? []);
}

async function handleGetOrderById(env: Env, id: string) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all();
  const row = resp.results?.[0] ?? null;
  return row ? json(row) : new Response(null, { status: 404 });
}

async function handleGetOpenOrders(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders WHERE terminateTime IS NULL ORDER BY createdAt DESC').all();
  return json(resp.results ?? []);
}

async function handleCreateOrder(env: Env, payload: OrderPayload) {
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

async function handleCreateAnalysis(env: Env, payload: AnalysisPayload) {
  await env.stocknotifier.prepare(
    `INSERT INTO indicator_analysis_records (symbol, analysisTime, rsiStatus, rsiValue, macdStatus, macdValue, macdSignalValue, kdStatus, kValue, dValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      payload.symbol ?? null,
      payload.analysisTime ?? null,
      payload.rsiStatus ?? null,
      payload.rsiValue ?? null,
      payload.macdStatus ?? null,
      payload.macdValue ?? null,
      payload.macdSignalValue ?? null,
      payload.kdStatus ?? null,
      payload.kValue ?? null,
      payload.dValue ?? null
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


// 取得 d1_migrations 的所有資料
async function handleGetD1Migrations(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM d1_migrations ORDER BY id').all();
  return json(resp.results ?? []);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, '').replace(/\/$/, ''); // trim leading/trailing slashes
    try {
      // 新增：GET /d1_migrations
      if (request.method === 'GET' && path === 'd1_migrations') {
        return await handleGetD1Migrations(env);
      }

      if (request.method === 'GET' && (path === 'orders' || path === '')) {
        return await handleGetOrders(env);
      }

      // 更具體的路徑要放在前面
      if (request.method === 'GET' && path === 'orders/open') {
        return await handleGetOpenOrders(env);
      }

      if (request.method === 'GET' && path.startsWith('orders/')) {
        const id = path.split('/')[1];
        return await handleGetOrderById(env, id);
      }

      if (request.method === 'POST' && path === 'orders') {
        const payload: OrderPayload = await request.json();
        return await handleCreateOrder(env, payload);
      }

      if (request.method === 'POST' && path === 'analysis') {
        const payload: AnalysisPayload = await request.json();
        return await handleCreateAnalysis(env, payload);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  }
};
