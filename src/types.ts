export interface Env {
  stocknotifier: D1Database;
  // optional Binance API bindings (can also come from secrets/env)
  BINANCE_API_KEY?: string;
  BINANCE_API_SECRET?: string;
  // when truthy, handler will use Binance testnet base URL
  BINANCE_USE_TESTNET?: string | boolean;
}

export interface OrderPayload {
  symbol: string;
  price?: number;
  qty?: number | null;
  quoteOrderQty?: number | null;
  action?: string | null;
  createdAt?: string | null;
  traderNo?: string | null;
  strategy?: string | null;
  terminateTime?: string | null;
  terminatePrice?: number | null;
}

export interface AnalysisPayload {
  symbol?: string;
  analysisTime?: string | null;
  rsiStatus?: string | null;
  rsiValue?: number | null;
  macdStatus?: string | null;
  macdValue?: number | null;
  macdSignalValue?: number | null;
  kdStatus?: string | null;
  kValue?: number | null;
  dValue?: number | null;
  kdKValue?: number | null;
  kdDValue?: number | null;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export interface BinanceOrderPayload {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  quantity?: number | string;
  price?: number | string;
  timeInForce?: string;
  recvWindow?: number;
}

export interface BinanceClientConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

export interface BinanceResponse {
  status: number;
  data: unknown;
}

export function getBinanceConfig(env: Env): BinanceClientConfig | null {
  const apiKey = env.BINANCE_API_KEY;
  const apiSecret = env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  const useTestnet = !!(env.BINANCE_USE_TESTNET === true || env.BINANCE_USE_TESTNET === 'true');
  const baseUrl = useTestnet ? 'https://testnet.binance.vision' : undefined;
  return { apiKey, apiSecret, baseUrl };
}
