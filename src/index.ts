import { Env, OrderPayload, AnalysisPayload } from './types';
import {
  handleGetOrders,
  handleGetOrderById,
  handleGetOpenOrders,
  handleCreateOrder,
  handleCreateAnalysis,
  handleGetD1Migrations
} from './handlers';

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/+/, '').replace(/\/+$/, ''); // trim leading/trailing slashes
    try {
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
