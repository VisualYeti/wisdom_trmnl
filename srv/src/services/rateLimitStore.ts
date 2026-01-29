import { Store, Options, ClientRateLimitInfo } from 'express-rate-limit';

interface RateLimitEntry {
  totalHits: number;
  resetTime: Date;
}

export interface RateLimitStatus {
  key: string;
  hits: number;
  limit: number;
  remaining: number;
  resetTime: string;
  isLimited: boolean;
}

export class TrackableStore implements Store {
  private hits: Map<string, RateLimitEntry> = new Map();
  private windowMs: number = 60000;
  private maxHits: number = 60;
  private storeName: string;

  constructor(storeName: string) {
    this.storeName = storeName;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.maxHits = typeof options.max === 'number' ? options.max : 60;

    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = Date.now();
    const resetTime = new Date(now + this.windowMs);

    let entry = this.hits.get(key);

    if (!entry || entry.resetTime.getTime() <= now) {
      // New window
      entry = { totalHits: 1, resetTime };
      this.hits.set(key, entry);
    } else {
      entry.totalHits++;
    }

    return {
      totalHits: entry.totalHits,
      resetTime: entry.resetTime,
    };
  }

  async decrement(key: string): Promise<void> {
    const entry = this.hits.get(key);
    if (entry && entry.totalHits > 0) {
      entry.totalHits--;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.hits.delete(key);
  }

  async resetAll(): Promise<void> {
    this.hits.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.hits.entries()) {
      if (entry.resetTime.getTime() <= now) {
        this.hits.delete(key);
      }
    }
  }

  getStatus(): RateLimitStatus[] {
    const now = Date.now();
    const result: RateLimitStatus[] = [];

    for (const [key, entry] of this.hits.entries()) {
      if (entry.resetTime.getTime() > now) {
        const remaining = Math.max(0, this.maxHits - entry.totalHits);
        result.push({
          key,
          hits: entry.totalHits,
          limit: this.maxHits,
          remaining,
          resetTime: entry.resetTime.toISOString(),
          isLimited: entry.totalHits >= this.maxHits,
        });
      }
    }

    return result;
  }

  getLimitedOnly(): RateLimitStatus[] {
    return this.getStatus().filter((s) => s.isLimited);
  }

  getStoreName(): string {
    return this.storeName;
  }
}

// Singleton stores for tracking
export const apiKeyStore = new TrackableStore('api-keys');
export const publicIpStore = new TrackableStore('public-ips');
