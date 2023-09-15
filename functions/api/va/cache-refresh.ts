import { VaCache } from "../../lib/va/cache";
import { cityUrls } from "../../lib/va/city-urls";
import { VaEnv } from "../../lib/va/env";
import { WeatherForecast } from "../../lib/va/types";
import { createWeatherService } from "../../lib/va/weather-service";

export const onRequest: PagesFunction<VaEnv> = async (context) => {
  const cities = Object.keys(cityUrls.DMI);
  const cache = new VaCache(context.env);
  const promises: Promise<WeatherForecast[] | null>[] = [];
  const weatherService = createWeatherService({ cache, env: context.env });
  for (const city of cities) {
    const sitePromises = Object.keys(weatherService).map((k) =>
      weatherService[k](city)
    );
    promises.push(...sitePromises);
  }
  context.waitUntil(Promise.all(promises));
  return new Response(null, { status: 202 });
};
