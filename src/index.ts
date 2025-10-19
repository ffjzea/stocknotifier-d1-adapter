export interface Env {
  DB: D1Database; // bound in wrangler.toml
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$|^\//g, ''); // trim leading/trailing slashes
    try {
      if (request.method === 'GET' && (path === 'orders' || path === '')) {
        const resp = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
        return json(resp.results ?? []);
      }

      if (request.method === 'GET' && path.startsWith('orders/')) {
        const id = path.split('/')[1];
        const resp = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all();
        const row = resp.results && resp.results.length ? resp.results[0] : null;
        return row ? json(row) : new Response(null, { status: 404 });
      }

      if (request.method === 'GET' && path === 'orders/open') {
        const resp = await env.DB.prepare('SELECT * FROM orders WHERE terminate_time IS NULL ORDER BY created_at DESC').all();
        return json(resp.results ?? []);
      }

      if (request.method === 'POST' && path === 'orders') {
        const payload = await request.json();
        // Basic insert - ensure columns exist in migration
        const insert = await env.DB.prepare(
          `INSERT INTO orders (symbol, price, qty, action, trader_no, strategy, quote_order_qty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(payload.symbol, payload.price ?? null, payload.qty ?? null, payload.action ?? null, payload.traderNo ?? null, payload.strategy ?? null, payload.quoteOrderQty ?? null)
          .run();

        // Retrieve last inserted id and return row
        const idRes = await env.DB.prepare("SELECT last_insert_rowid() as id").all();
        const id = idRes.results && idRes.results[0] ? idRes.results[0].id : null;
        if (id) {
          const row = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).all();
          return json(row.results && row.results[0] ? row.results[0] : {}, 201);
        }
        return json({}, 201);
      }

      if (request.method === 'POST' && path === 'analysis') {
        const payload = await request.json();
        const insert = await env.DB.prepare(
          `INSERT INTO indicator_analysis_records (symbol, strategy, timeframe, metrics, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
        )
          .bind(payload.symbol ?? null, payload.strategy ?? null, payload.timeframe ?? null, JSON.stringify(payload.metrics) ?? null)
          .run();
        const idRes = await env.DB.prepare("SELECT last_insert_rowid() as id").all();
        const id = idRes.results && idRes.results[0] ? idRes.results[0].id : null;
        if (id) {
          const row = await env.DB.prepare('SELECT * FROM indicator_analysis_records WHERE id = ?').bind(id).all();
          return json(row.results && row.results[0] ? row.results[0] : {}, 201);
        }
        return json({}, 201);
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  }
};
