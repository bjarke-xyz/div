import { VaCache } from "./cache";
import { cityUrls } from "./city-urls";
import { VaEnv } from "./env";
import {
  getTv2Weather,
  getDmiWeather,
  getYrApiWeather,
  getOwmWeather,
  getSunData,
} from "./parsers";
import { SunData, WeatherForecast } from "./types";

type Site = "TV2" | "DMI" | "YR" | "OWM";
type City = "ODENSE" | "AARHUS" | "KØBENHAVN" | "ESBJERG" | "AALBORG";

const CACHE_TIME_IN_SECONDS = 3600;

const DEFAULT_CITY = "Odense";

function getUrl(site: Site, city: string, owmApiKey?: string) {
  let url = cityUrls?.[site]?.[city.toUpperCase() as City];
  if (site == "OWM") {
    url = `${url}&appid=${owmApiKey}`;
  }
  return url;
}

async function getHtmlData(
  cache: VaCache,
  url: string
): Promise<string | null> {
  if (!url) {
    return null;
  }

  const cached = await cache.get(`HTML:${url}`);
  if (cached) {
    console.log(`fetched ${url} from cache`);
    return cached;
  }
  try {
    const resp = await fetch(url);
    const html = await resp.text();
    await cache.set(`HTML:${url}`, html, CACHE_TIME_IN_SECONDS);
    console.log(`fetched ${url} from source`);
    return html;
  } catch (error) {
    console.error("error getting data at url", url, error);
    return null;
  }
}

async function getJsonData(
  cache: VaCache,
  url: string,
  headers?: Record<string, string>
): Promise<string | null> {
  if (!url) {
    return null;
  }

  const cached = await cache.get(`JSON:${url}`);
  if (cached) {
    console.log(`fetched ${url} from cache`);
    return cached;
  }

  try {
    const resp = await fetch(url, {
      headers: {
        ...(headers ?? {}),
      },
    });
    const json = await resp.json();
    const data = JSON.stringify(json);
    await cache.set(`JSON:${url}`, data, CACHE_TIME_IN_SECONDS);
    console.log(`fetched ${url} from source`);
    return data;
  } catch (error) {
    console.error("error getting json at url", url, error);
    return null;
  }
}

export const getSunDataHelper = async (
  cache: VaCache,
  env: VaEnv,
  city?: string | null
): Promise<SunData | null> => {
  const url = getUrl("OWM", city ?? DEFAULT_CITY, env.OWM_API_KEY);
  const owmJson = await getJsonData(cache, url);
  if (!owmJson) return null;
  const sunData = getSunData(owmJson);
  return sunData;
};

export type WeatherServiceFunc = (
  city?: string | null
) => Promise<WeatherForecast[] | null>;
type WeatherService = Record<string, WeatherServiceFunc>;

export const createWeatherService = ({
  cache,
  env,
}: {
  cache: VaCache;
  env: VaEnv;
}): WeatherService => {
  return {
    TV2: async (city?: string | null) => {
      const url = getUrl("TV2", city ?? DEFAULT_CITY);
      const data = await getHtmlData(cache, url);
      if (!data) return null;

      const forecast = getTv2Weather(data);
      return forecast;
    },

    DMI: async (city?: string | null) => {
      const url = getUrl("DMI", city ?? DEFAULT_CITY);
      const data = await getJsonData(cache, url);
      if (!data) return null;

      const forecast = getDmiWeather(data);
      return forecast;
    },

    YR: async (city?: string | null) => {
      try {
        const url = getUrl("YR", city ?? DEFAULT_CITY);
        const data = await getJsonData(cache, url, {
          "User-Agent": "va github.com/bjarke-xyz/va",
        });
        if (!data) return null;

        const forecast = getYrApiWeather(data);
        return forecast;
      } catch (error) {
        console.log(`could not get yr data: ${error}`);
        return [];
      }
    },

    OWM: async (city?: string | null) => {
      const url = getUrl("OWM", city ?? DEFAULT_CITY, env.OWM_API_KEY);
      try {
        const data = await getJsonData(cache, url);
        if (!data) return null;
        const forecast = getOwmWeather(data);
        return forecast;
      } catch (error) {
        console.log("Error getting OWM data");
        return null;
      }
    },
  };
};
