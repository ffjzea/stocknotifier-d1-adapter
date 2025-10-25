import { BinanceOrderPayload, Env, getBinanceConfig } from './types';

export interface BinanceResponse {
  status: number;
  data: unknown;
}

export class BinanceClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  // cached server time offset (serverTime - localTime)
  private timeOffsetMillis: number | null = null;
  private lastTimeSync: number | null = null;

  constructor(apiKey: string, apiSecret: string, baseUrl = 'https://api.binance.com') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /** Create a BinanceClient from Env (factory) */
  public static fromEnv(env: Env): BinanceClient | null {
    const cfg = getBinanceConfig(env);
    if (!cfg) return null;
    return new BinanceClient(cfg.apiKey, cfg.apiSecret, cfg.baseUrl);
  }

  private async hmacSha256(message: string) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(this.apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    const bytes = new Uint8Array(sig);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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

  private async getPriceTickSize(symbol: string): Promise<number> {
    const resp = await this.getExchangeInfo(symbol);
    if (resp.status !== 200) throw new Error(`Failed to get exchange info for tickSize: status ${resp.status}`);
    const data = resp.data as any;
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

  private async getQuantityStepSize(symbol: string): Promise<number> {
    const resp = await this.getExchangeInfo(symbol);
    if (resp.status !== 200) throw new Error(`Failed to get exchange info for stepSize: status ${resp.status}`);
    const data = resp.data as any;
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

  private truncateToStep(value: number, step: number): number {
    const ticks = Math.floor(value / step);
    return ticks * step;
  }

  private alignPriceToTick(price: number, tickSize: number): number {
    const ticks = Math.floor(price / tickSize);
    return ticks * tickSize;
  }

  public async placeOrder(payload: BinanceOrderPayload): Promise<BinanceResponse> {
    await this.ensureTimeSync();
    const timestamp = Date.now() + (this.timeOffsetMillis ?? 0);

    // Adjust quantity to step size
    let quantity = payload.quantity;
    if (typeof quantity === 'number') {
      const stepSize = await this.getQuantityStepSize(payload.symbol);
      quantity = this.truncateToStep(quantity, stepSize);
    }

    // Adjust price to tick size
    let price = payload.price;
    if (typeof price === 'number') {
      const tickSize = await this.getPriceTickSize(payload.symbol);
      price = this.alignPriceToTick(price, tickSize);
    }

    const params: Record<string, unknown> = {
      symbol: payload.symbol,
      side: payload.side,
      type: payload.type,
      quantity,
      price,
      timeInForce: payload.timeInForce,
      recvWindow: payload.recvWindow,
      timestamp
    };

    const qs = this.buildQueryString(params);
    const signature = await this.hmacSha256(qs);
    const body = `${qs}&signature=${signature}`;

    const resp = await fetch(`${this.baseUrl}/api/v3/order`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const data = await resp.json().catch(() => ({ error: 'Invalid JSON response', status: resp.status }));
    return { status: resp.status, data };
  }

  /**
   * Get spot account information (SIGNED)
   * https://binance-docs.github.io/apidocs/spot/en/#account-information-user_data
   */
  public async getSpotAccount(recvWindow?: number): Promise<BinanceResponse> {
    await this.ensureTimeSync();
    const timestamp = Date.now() + (this.timeOffsetMillis ?? 0);
    const params: Record<string, unknown> = { timestamp };
    if (recvWindow !== undefined) params.recvWindow = recvWindow;

    const qs = this.buildQueryString(params);
    const signature = await this.hmacSha256(qs);
    const url = `${this.baseUrl}/api/v3/account?${qs}&signature=${signature}`;

    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.apiKey
      }
    });

    const data = await resp.json().catch(() => ({ error: 'Invalid JSON response', status: resp.status }));
    return { status: resp.status, data };
  }

  /**
   * Get klines/candlestick data (PUBLIC)
   * https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
   */
  public async getKlines(symbol: string, interval: string, limit?: number, startTime?: number, endTime?: number): Promise<BinanceResponse> {
    const params: Record<string, unknown> = { symbol, interval };
    if (limit !== undefined) params.limit = limit;
    if (startTime !== undefined) params.startTime = startTime;
    if (endTime !== undefined) params.endTime = endTime;

    const qs = this.buildQueryString(params);
    const suffix = qs ? ('?' + qs) : '';
    const url = this.baseUrl + '/api/v3/klines' + suffix;

    const resp = await fetch(url, { method: 'GET' });
    const data = await resp.json().catch(() => ({ error: 'Invalid JSON response', status: resp.status }));
    return { status: resp.status, data };
  }

  /**
   * Get exchange information (PUBLIC). Optionally pass a symbol to filter.
   * https://binance-docs.github.io/apidocs/spot/en/#exchange-information
   */
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

  /**
   * Ensure we have a recent server time offset. Uses a 5 minute TTL.
   */
  private async ensureTimeSync(): Promise<void> {
    const TTL = 5 * 60 * 1000; // 5 minutes
    if (this.lastTimeSync && (Date.now() - this.lastTimeSync) < TTL && this.timeOffsetMillis !== null) return;
    try {
      const resp = await fetch(`${this.baseUrl}/api/v3/time`, { method: 'GET' });
      const json = await resp.json().catch(() => null) as any;
      const serverTime = typeof json?.serverTime === 'number' ? json.serverTime : null;
      if (serverTime !== null) {
        this.timeOffsetMillis = serverTime - Date.now();
        this.lastTimeSync = Date.now();
      }
    } catch {
      // swallow - we'll fall back to local clock
    }
  }
}
