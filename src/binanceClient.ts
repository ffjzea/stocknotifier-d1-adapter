import { BinanceOrderPayload, Env, getBinanceConfig } from './types';

export interface BinanceResponse {
  status: number;
  data: unknown;
}

export class BinanceClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

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

  public async placeOrder(payload: BinanceOrderPayload): Promise<BinanceResponse> {
    const timestamp = Date.now();
    const params: Record<string, unknown> = {
      symbol: payload.symbol,
      side: payload.side,
      type: payload.type,
      quantity: payload.quantity,
      price: payload.price,
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
    const timestamp = Date.now();
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
}
