import { addSeconds, isAfter, parseISO } from "date-fns";
import { VaEnv } from "./env";

type r2Metadata = {
  expiresAt: string;
} & Record<string, string>;

export class VaCache {
  private readonly keyPrefix = "CACHE:";
  constructor(private readonly env: VaEnv) { }

  private getKey(key: string) {
    return `${this.keyPrefix}:${key}`;
  }
  set(key: string, value: string, ttl: number): Promise<unknown> {
    return this.env.div.put(this.getKey(key), value, {
      customMetadata: {
        expiresAt: addSeconds(new Date(), ttl).toISOString(),
      } as r2Metadata,
    });
  }

  async get(key: string): Promise<string | null> {
    const objBody = await this.env.div.get(this.getKey(key));
    if (!objBody) return null;
    const metadata = objBody.customMetadata as r2Metadata;
    if (metadata && metadata.expiresAt) {
      const expiresAtDate = parseISO(metadata.expiresAt);
      const now = new Date();
      if (isAfter(now, expiresAtDate)) {
        return null;
      }
    }
    const text = await objBody.text();
    return text
  }
}
