import { BinanceResponse } from './types';

export class ExchangeInfoManager {
  private readonly baseUrl: string;
  private exchangeInfoCache: Map<string, any> = new Map();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public async getExchangeInfo(symbol?: string): Promise<BinanceResponse> {
    const params: Record<string, unknown> = {};
    if (symbol !== undefined) params.symbol = symbol;

    const qs = this.buildQueryString(params);
    const suffix = qs ? ('?' + qs) : '';
    const url = this.baseUrl + '/api/v3/exchangeInfo' + suffix;

    const resp = await fetch(url, { method: 'GET' });
    const data = await resp.json().catch(() => ({ error: 'Invalid JSON response', status: resp.status }));
    return { status: resp.status, data };
  }

  private buildQueryString(params: Record<string, unknown>) {
    const parts: string[] = [];
    for (const k of Object.keys(params)) {
      const v = params[k as any];
      if (v === undefined || v === null) continue;
      let s: string;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        s = String(v);
      } else {
        s = JSON.stringify(v);
      }
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(s)}`);
    }
    return parts.join('&');
  }

  private async getCachedExchangeInfo(symbol: string): Promise<any> {
    if (this.exchangeInfoCache.has(symbol)) {
      return this.exchangeInfoCache.get(symbol);
    }
    const resp = await this.getExchangeInfo(symbol);
    if (resp.status !== 200) throw new Error(`Failed to get exchange info: status ${resp.status}`);
    this.exchangeInfoCache.set(symbol, resp.data);
    return resp.data;
  }

  public async getPriceTickSize(symbol: string): Promise<number> {
    const data = await this.getCachedExchangeInfo(symbol);
    const symbols = data.symbols;
    if (!Array.isArray(symbols) || symbols.length === 0) throw new Error('No symbols found in exchange info');
    const filters = symbols[0].filters;
    for (const f of filters) {
      if (f.filterType === 'PRICE_FILTER') {
        return Number.parseFloat(f.tickSize);
      }
    }
    throw new Error('PRICE_FILTER not found in exchange info');
  }

  public async getQuantityStepSize(symbol: string): Promise<number> {
    const data = await this.getCachedExchangeInfo(symbol);
    const symbols = data.symbols;
    if (!Array.isArray(symbols) || symbols.length === 0) throw new Error('No symbols found in exchange info');
    const filters = symbols[0].filters;
    for (const f of filters) {
      if (f.filterType === 'LOT_SIZE') {
        return Number.parseFloat(f.stepSize);
      }
    }
    throw new Error('LOT_SIZE not found in exchange info');
  }
}