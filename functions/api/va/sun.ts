import { VaCache } from "../../lib/va/cache";
import { VaEnv } from "../../lib/va/env";
import { getSunDataHelper } from "../../lib/va/weather-service";

const CACHE_TIME_IN_SECONDS = 30 * 60;
export const onRequest: PagesFunction<VaEnv> = async (context) => {
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = await caches.open("default");
  let response = await cache.match(cacheKey);
  if (!response) {
    const vaCache = new VaCache(context.env);
    const url = new URL(context.request.url);
    const city = url.searchParams.get("city");
    const sunData = await getSunDataHelper(vaCache, context.env, city);
    response = new Response(JSON.stringify(sunData), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${CACHE_TIME_IN_SECONDS}`,
      },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
};
