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
  binanceAccount: new URLPattern({ pathname: '/binance/account' }),
  binanceKlines: new URLPattern({ pathname: '/binance/klines' }),
  binanceExchangeInfo: new URLPattern({ pathname: '/binance/exchangeInfo' }),
  // (版本化路由已移除)
};

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    try {
      const method = request.method;

      const handleSimpleGet = async (pathname: string, env: Env): Promise<Response | null> => {
        if (patterns.d1Migrations.test({ pathname })) {
          return await handleGetD1Migrations(env);
        }
        if (patterns.orders.test({ pathname }) || patterns.ordersRoot.test({ pathname })) {
          return await handleGetOrders(env);
        }
        if (patterns.ordersOpen.test({ pathname })) {
          return await handleGetOpenOrders(env);
        }

        const orderMatch = patterns.orderById.exec({ pathname });
        if (orderMatch) {
          const id = orderMatch.pathname.groups?.id;
          if (id) return handleGetOrderById(env, id);
        }
        return null;
      };

      const handleBinanceGet = async (request: Request, pathname: string, env: Env): Promise<Response | null> => {
        if (patterns.binanceAccount.test({ pathname })) {
          const urlObj = new URL(request.url);
          const recvWindow = urlObj.searchParams.get('recvWindow');
          const recv = recvWindow ? Number.parseInt(recvWindow, 10) : undefined;
          const mod = await import('./handlers');
          return mod.handleBinanceAccount(env, recv);
        }

        if (patterns.binanceKlines.test({ pathname })) {
          const urlObj = new URL(request.url);
          const symbol = urlObj.searchParams.get('symbol') ?? '';
          const interval = urlObj.searchParams.get('interval') ?? '1m';
          const limit = urlObj.searchParams.has('limit') ? Number.parseInt(urlObj.searchParams.get('limit')!, 10) : undefined;
          const startTime = urlObj.searchParams.has('startTime') ? Number.parseInt(urlObj.searchParams.get('startTime')!, 10) : undefined;
          const endTime = urlObj.searchParams.has('endTime') ? Number.parseInt(urlObj.searchParams.get('endTime')!, 10) : undefined;
          if (!symbol) return new Response(JSON.stringify({ error: 'Missing symbol query parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          const mod = await import('./handlers');
          return mod.handleBinanceKlines(env, symbol, interval, limit, startTime, endTime);
        }

        if (patterns.binanceExchangeInfo.test({ pathname })) {
          const urlObj = new URL(request.url);
          const symbol = urlObj.searchParams.get('symbol') ?? undefined;
          const mod = await import('./handlers');
          return mod.handleBinanceExchangeInfo(env, symbol);
        }

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
      if (method === 'GET') {
        resp = await handleSimpleGet(pathname, env);
        resp ??= await handleBinanceGet(request, pathname, env);
      }
      if (method === 'POST') resp = await handlePost();

      if (resp) return resp;
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  }
};
