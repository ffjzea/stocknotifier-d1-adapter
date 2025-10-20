export interface Env {
  stocknotifier: D1Database; // bound in wrangler.toml
}

interface OrderPayload {
  symbol: string;
  price?: number;
  qty?: number;
  action?: string;
  traderNo?: string;
  strategy?: string;
  quoteOrderQty?: number;
}

interface AnalysisPayload {
  symbol?: string;
  strategy?: string;
  timeframe?: string;
  metrics: unknown;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleGetOrders(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  return json(resp.results ?? []);
}

async function handleGetOrderById(env: Env, id: string) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all();
  const row = resp.results?.[0] ?? null;
  return row ? json(row) : new Response(null, { status: 404 });
}

async function handleGetOpenOrders(env: Env) {
  const resp = await env.stocknotifier.prepare('SELECT * FROM orders WHERE terminate_time IS NULL ORDER BY created_at DESC').all();
  return json(resp.results ?? []);
}

async function handleCreateOrder(env: Env, payload: OrderPayload) {
  await env.stocknotifier.prepare(
    `INSERT INTO orders (symbol, price, qty, action, trader_no, strategy, quote_order_qty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(payload.symbol, payload.price ?? null, payload.qty ?? null, payload.action ?? null, payload.traderNo ?? null, payload.strategy ?? null, payload.quoteOrderQty ?? null)
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
    `INSERT INTO indicator_analysis_records (symbol, strategy, timeframe, metrics, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(payload.symbol ?? null, payload.strategy ?? null, payload.timeframe ?? null, JSON.stringify(payload.metrics) ?? null)
    .run();

  const idRes = await env.stocknotifier.prepare("SELECT last_insert_rowid() as id").all();
  const id = idRes.results?.[0]?.id;
  if (id) {
    const row = await env.stocknotifier.prepare('SELECT * FROM indicator_analysis_records WHERE id = ?').bind(id).all();
    return json(row.results?.[0] ?? {}, 201);
  }
  return json({}, 201);
}

async function handleCreateMockAnalysis(env: Env) {
  // 生成模擬的 analysis 資料
  const mockData = {
    symbol: 'TSLA',
    strategy: 'momentum_strategy',
    timeframe: '1h',
    metrics: {
      rsi: 65.4,
      macd: {
        signal: 0.8,
        histogram: 1.2,
        macd: 2
      },
      bollinger_bands: {
        upper: 245.5,
        middle: 240,
        lower: 234.5,
        position: 'above_middle'
      },
      volume_profile: {
        avg_volume: 45000000,
        current_volume: 52000000,
        volume_ratio: 1.16
      },
      trend_analysis: {
        direction: 'bullish',
        strength: 'moderate',
        confidence: 0.75
      },
      price_action: {
        current_price: 242.15,
        price_change_1h: 2.35,
        price_change_percent: 0.98
      },
      analysis_timestamp: new Date().toISOString(),
      signals: ['BUY', 'MOMENTUM_UP'],
      risk_level: 'medium'
    }
  };

  await env.stocknotifier.prepare(
    `INSERT INTO indicator_analysis_records (symbol, strategy, timeframe, metrics, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  )
    .bind(mockData.symbol, mockData.strategy, mockData.timeframe, JSON.stringify(mockData.metrics))
    .run();

  const idRes = await env.stocknotifier.prepare("SELECT last_insert_rowid() as id").all();
  const id = idRes.results?.[0]?.id;
  if (id) {
    const row = await env.stocknotifier.prepare('SELECT * FROM indicator_analysis_records WHERE id = ?').bind(id).all();
    return json(row.results?.[0] ?? {}, 201);
  }
  return json(mockData, 201);
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

      if (request.method === 'POST' && path === 'test/analysis') {
        return await handleCreateMockAnalysis(env);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  }
};
