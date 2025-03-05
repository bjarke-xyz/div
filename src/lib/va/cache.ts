import { addSeconds, isAfter, parseISO } from "date-fns";
import { Env, getS3 } from "../util";

type r2Metadata = {
  expiresAt: string;
} & Record<string, string>;

interface VaCacheObj {
  content: string;
  customMetadata: r2Metadata;
}

export class VaCache {
  private readonly keyPrefix = "VA/CACHE";
  constructor(private readonly env: Env) {}

  private getKey(key: string) {
    const keyFormatted = key.replace(/[<>:"/\\|?*]/g, "_");
    return `${this.keyPrefix}/${keyFormatted}`;
  }
  async set(key: string, value: string, ttl: number): Promise<unknown> {
    const s3 = getS3(this.env);
    const s3File = s3.file(this.getKey(key));
    const obj = {
      content: value,
      customMetadata: {
        expiresAt: addSeconds(new Date(), ttl).toISOString(),
      },
    } as VaCacheObj;
    await s3File.write(JSON.stringify(obj));
    return null;
  }

  async get(key: string): Promise<string | null> {
    const s3 = getS3(this.env);
    const s3File = s3.file(this.getKey(key));
    const fileExists = await s3File.exists();
    if (!fileExists) return null;

    const objBody = (await s3File.json()) as VaCacheObj;
    if (!objBody) return null;

    const metadata = objBody.customMetadata;
    if (metadata && metadata.expiresAt) {
      const expiresAtDate = parseISO(metadata.expiresAt);
      const now = new Date();
      if (isAfter(now, expiresAtDate)) {
        return null;
      }
    }
    const text = objBody.content;
    return text;
  }
}
