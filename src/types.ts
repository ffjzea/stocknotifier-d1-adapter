export interface Env {
  stocknotifier: D1Database;
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
