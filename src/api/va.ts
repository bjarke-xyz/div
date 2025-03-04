import { Hono } from "hono";
import { getEnv } from "../lib/util";
import { VaCache } from "../lib/va/cache";
import { cityUrls } from "../lib/va/city-urls";
import { WeatherForecast } from "../lib/va/types";
import {
  createWeatherService,
  getSunDataHelper,
} from "../lib/va/weather-service";

export const vaApi = new Hono();

vaApi.get("/cities", (c) => {
  const cities = Object.keys(cityUrls.DMI).map((city) => {
    const firstLetterUpper = city[0].toUpperCase();
    return `${firstLetterUpper}${city.slice(1).toLowerCase()}`;
  });
  return c.json(cities);
});

vaApi.get("/sun", async (c) => {
  // TODO: caching
  const env = getEnv();
  const vaCache = new VaCache(env);
  const city = c.req.query("city");
  const sunData = await getSunDataHelper(vaCache, env, city);
  return c.json(sunData);
});

type WeatherForecastResponse = Record<string, WeatherForecast[] | null>;

vaApi.get("/weather", async (c) => {
  // const CACHE_TIME_IN_SECONDS = 30 * 60;
  // TODO: caching
  const env = getEnv();
  const vaCache = new VaCache(env);
  const city = c.req.query("city");
  const weatherServices = createWeatherService({
    cache: vaCache,
    env: env,
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
  return c.json(weatherForecastResponse);
});

vaApi.get("/proxy/dmi/symbol/:id", async (c) => {
  const CACHE_TIME_IN_SECONDS = 30 * 24 * 60 * 60; // 30 days
  // TODO: caching
  const id = c.req.param("id");
  if (!id) {
    return c.status(400);
  } else {
    const dmiUrl = `https://www.dmi.dk/assets/img/${id}.svg`;
    try {
      const fetchResp = await fetch(dmiUrl);
      const fetchBody = await fetchResp.text();
      c.res = new Response(fetchBody, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": `s-maxage=${CACHE_TIME_IN_SECONDS}`,
        },
      });
    } catch (error) {
      console.error("dmi proxy error", error);
      return c.text("DMI fetch error", 500);
    }
  }
});

vaApi.get("/cache-refresh", async (c) => {
  const env = getEnv();
  const cities = Object.keys(cityUrls.DMI);
  const cache = new VaCache(env);
  const promises: Promise<WeatherForecast[] | null>[] = [];
  const weatherService = createWeatherService({ cache, env: env });
  for (const city of cities) {
    const sitePromises = Object.keys(weatherService).map((k) =>
      weatherService[k](city)
    );
    promises.push(...sitePromises);
  }
  await Promise.all(promises);
  c.status(202);
});
