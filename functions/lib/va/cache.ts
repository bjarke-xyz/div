import { VaEnv } from "./env";

export class VaCache {
  private readonly keyPrefix = "CACHE:";
  constructor(private readonly env: VaEnv) {}

  private getKey(key: string) {
    return `${this.keyPrefix}:${key}`;
  }
  set(key: string, value: string, ttl: number) {
    return this.env.KV_VA.put(this.getKey(key), value, {
      expirationTtl: ttl,
    });
  }

  get(key: string) {
    return this.env.KV_VA.get(this.getKey(key));
  }
}
