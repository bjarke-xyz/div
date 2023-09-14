import { VaCache } from "../../lib/va/cache";
import { VaEnv } from "../../lib/va/env";
import { WeatherForecast } from "../../lib/va/types";
import { createWeatherService } from "../../lib/va/weather-service";

type WeatherForecastResponse = Record<string, WeatherForecast[] | null>;

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
    const weatherServices = createWeatherService({
      cache: vaCache,
      env: context.env,
    });
    const promises = Object.keys(weatherServices).map(async (k) => ({
      [k]: await weatherServices[k](city),
    }));
    const results = await Promise.all(promises);
    const weatherForecastResponse: WeatherForecastResponse = results.reduce(
      (prev, curr) => {
        const key = Object.keys(curr)[0];
        prev[key.toLowerCase()] = curr[key];
        return prev;
      },
      {}
    );
    response = new Response(JSON.stringify(weatherForecastResponse), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `s-maxage=${CACHE_TIME_IN_SECONDS}`,
      },
    });
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
};
