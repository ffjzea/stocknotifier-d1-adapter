import { Env, OrderPayload, AnalysisPayload } from './types';
import {
  handleGetOrders,
  handleGetOrderById,
  handleGetOpenOrders,
  handleCreateOrder,
  handleCreateAnalysis,
  handleGetD1Migrations
} from './handlers';

// 將 URLPattern 的生命週期移到模組頂端，避免每次 request 都重建
const patterns = {
  d1Migrations: new URLPattern({ pathname: '/d1_migrations' }),
  ordersRoot: new URLPattern({ pathname: '/' }),
  orders: new URLPattern({ pathname: '/orders' }),
  ordersOpen: new URLPattern({ pathname: '/orders/open' }),
  orderById: new URLPattern({ pathname: '/orders/:id' }),
  analysis: new URLPattern({ pathname: '/analysis' }),
  binanceOrder: new URLPattern({ pathname: '/binance/order' }),
  // (版本化路由已移除)
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      const method = request.method;

      const handleGet = async () => {
        if (patterns.d1Migrations.test({ pathname })) {
          return await handleGetD1Migrations(env);
        }
        if (patterns.orders.test({ pathname }) || patterns.ordersRoot.test({ pathname })) {
          return await handleGetOrders(env);
        }
        if (patterns.ordersOpen.test({ pathname })) {
          return await handleGetOpenOrders(env);
        }

        let orderMatch = patterns.orderById.exec({ pathname });
        if (orderMatch) {
          const id = orderMatch.pathname.groups?.id;
          if (id) return handleGetOrderById(env, id);
        }

        // no versioned id route

        return null;
      };

      const handlePost = async () => {
        if (patterns.orders.test({ pathname })) {
          const payload: OrderPayload = await request.json();
          return handleCreateOrder(env, payload);
        }
        if (patterns.analysis.test({ pathname })) {
          const payload: AnalysisPayload = await request.json();
          return handleCreateAnalysis(env, payload);
        }
        if (patterns.binanceOrder.test({ pathname })) {
          const payload = await request.json();
          // lazy import to avoid affecting cold start of existing handlers
          const mod = await import('./handlers');
          return mod.handleBinanceOrder(env, payload as any);
        }
        return null;
      };

      let resp: Response | Promise<Response> | null = null;
      if (method === 'GET') resp = await handleGet();
      if (method === 'POST') resp = await handlePost();

      if (resp) return resp;
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  }
};
