import { parseISO } from "date-fns";
import { Env, getS3 } from "../util";
import { DayEvent, SourceType } from "./models";

const getKey = (source: SourceType) => `food-days/${source}`;

const cache = new Map<string, string>();

export class EventsRepository {
  private readonly env: Env;
  constructor(env: Env) {
    this.env = env;
  }
  async getEvents(): Promise<DayEvent[]> {
    const key = getKey("wikipedia");
    let eventsStr: string | null = null;
    if (!cache.has(key)) {
      const s3 = getS3(this.env);
      const eventsFile = s3.file(key);
      const eventsFileExists = await eventsFile.exists();
      if (!eventsFileExists) {
        return [];
      }
      eventsStr = await eventsFile.text();
      cache.set(key, eventsStr);
    } else {
      eventsStr = cache.get(key) ?? null;
    }
    if (!eventsStr) {
      return [];
    }

    const parsed: DayEvent[] = JSON.parse(eventsStr);
    return parsed.map((x) => ({
      ...x,
      date: parseISO(x.date as string),
    }));
  }

  async writeEvents(source: SourceType, events: DayEvent[]) {
    const s3 = getS3(this.env);
    const key = getKey(source);
    const eventsStr = JSON.stringify(events);
    const eventsFile = s3.file(key);
    await eventsFile.write(eventsStr);
    cache.set(key, eventsStr);
  }
}
