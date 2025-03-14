import { load } from "cheerio";
import { addDays, addHours, Locale, parse, parseISO, setHours } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { da } from "date-fns/locale";
import { SunData, WeatherForecast } from "./types";

const TIME_ZONE = "Europe/Copenhagen";

function getTv2Weather(html: string): WeatherForecast[] {
  const source = "TV2";
  const forecast: WeatherForecast[] = [];

  const $ = load(html);
  const locationTable = $(".location-table");
  locationTable.each((_, elem) => {
    const dateStr =
      $(elem).find("caption > div > time")?.attr("datetime") ?? "";
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return;

    const tr = $(elem).find("tbody > tr");
    tr.each((_, row) => {
      const timestampStr = $(row).find(".time > time").attr("datetime") ?? "";
      const timestamp = parseWithTimeZone(
        timestampStr,
        "yyyy-MM-dd HH:mm",
        new Date(),
        TIME_ZONE
      );
      if (isNaN(timestamp.getTime())) {
        throw new Error(`invalid timestamp (tv2): ${timestampStr}`);
      }

      const description = $(row).find(".icon > img").attr("alt") ?? "";
      const temperature = Number($(row).find(".degrees").text());
      const precipitation = $(row).find(".precipitation").text();

      forecast.push({
        source,
        timestamp,
        description,
        temperature,
        precipitation,
      });
    });
  });

  return forecast;
}

interface DMITimeSerie {
  time: string;
  temp: number;
  symbol: number;
  precipType: string;
}
interface DMIJson {
  city: string;
  timeserie: DMITimeSerie[];
}
function getDmiWeather(json: string): WeatherForecast[] {
  const source = "DMI";
  const forecast: WeatherForecast[] = [];
  const data = JSON.parse(json) as DMIJson;
  for (const point of data.timeserie) {
    if (!point.time) continue;

    const timestamp = parseWithTimeZone(
      point.time,
      "yyyyMMddHHmmss",
      new Date(),
      TIME_ZONE
    );
    if (isNaN(timestamp.getTime())) {
      throw new Error(`invalid date (dmi): ${point.time}`);
    }
    // const description = `https://www.dmi.dk/assets/img/${point.symbol}.svg`;
    const description = `${point.symbol}`;
    const temperature = Math.round(point.temp);
    const precipitation = "N/A";

    forecast.push({
      source,
      timestamp,
      description,
      temperature,
      precipitation,
    });
  }

  return forecast;
}

interface YrApiNextXHours {
  summary: {
    symbol_code: string;
  };
  details: {
    precipitation_amount: number;
  };
}
interface YrApiTimeserie {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature: number;
      };
    };
    next_12_hours: YrApiNextXHours | null;
    next_1_hours: YrApiNextXHours | null;
    next_6_hours: YrApiNextXHours | null;
  };
}
interface YrApiJson {
  properties: {
    meta: {
      units: {
        precipitation_amount: string;
      };
    };
    timeseries: YrApiTimeserie[];
  };
}
function getYrApiWeather(json: string): WeatherForecast[] {
  const source = "YR";
  const forecast: WeatherForecast[] = [];
  const data = JSON.parse(json) as YrApiJson;
  for (const timeserie of data.properties.timeseries) {
    const timestamp = parseISO(timeserie.time);
    if (isNaN(timestamp.getTime())) {
      throw new Error(`invalid timestamp (yr): ${timeserie.time}`);
    }
    const yrNextxHours =
      timeserie.data.next_1_hours ??
      timeserie.data.next_6_hours ??
      timeserie.data.next_12_hours;
    const description = yrNextxHours?.summary?.symbol_code ?? "";
    const temperature = Math.round(
      timeserie.data.instant.details.air_temperature
    );
    const precipitationAmount =
      yrNextxHours?.details?.precipitation_amount?.toString() ?? "N/A";
    const precipitation =
      precipitationAmount !== "N/A"
        ? `${precipitationAmount} ${data.properties.meta.units.precipitation_amount}`
        : precipitationAmount;
    forecast.push({
      source,
      timestamp,
      description,
      temperature,
      precipitation,
    });
  }
  return forecast;
}

function getYrWeather(html: string): WeatherForecast[] {
  const source = "YR";
  const forecast: WeatherForecast[] = [];

  const $ = load(html);
  const tables = $(".yr-table-hourly");
  tables.each((_, elem) => {
    const datetimeParts = $(elem).find("caption").text().split(",");
    const datetimeText = (datetimeParts[1] || datetimeParts[0]).trim();
    const date = parseWithTimeZone(
      datetimeText,
      "d. MMMM yyyy",
      new Date(),
      TIME_ZONE,
      {
        locale: da,
      }
    );
    if (isNaN(date.getTime())) {
      throw new Error(`Could not parse date (yr): ${datetimeText}`);
    }

    const tr = $(elem).find("tbody > tr");
    tr.each((_, row) => {
      const timeParts = $(row)
        .find("td[scope=row] > strong")
        .text()
        .split("kl");
      const timeText = timeParts[1].trim();
      const timestamp = setHours(date, Number(timeText));
      if (isNaN(timestamp.getTime())) {
        throw new Error(`invalid timestamp (yr): ${timeText}`);
      }

      const description = $(row).find("figcaption").text();
      const temperature = Number(
        $(row).find(".temperature").text().split("°")[0]
      );
      const precipitation = $(row).find(".precipitation").text();

      forecast.push({
        source,
        timestamp,
        description,
        temperature,
        precipitation,
      });
    });
  });

  return forecast;
}

interface OwmApiResponse {
  list: {
    dt: number;
    main: {
      temp: number;
    };
    weather: {
      main: string;
      description: string;
    }[];
    rain: {
      "3h": string;
    };
  }[];
  city: {
    sunrise: number;
    sunset: number;
  };
}
function getOwmWeather(json: string): WeatherForecast[] {
  const source = "OWM";
  const forecast: WeatherForecast[] = [];
  const data = JSON.parse(json) as OwmApiResponse;

  for (const point of data.list) {
    const timestamp = new Date(point.dt * 1000);
    if (isNaN(timestamp.getTime())) {
      throw new Error(`invalid timestamp (owm): ${point.dt}`);
    }
    const description = point.weather[0]?.description;
    const temperature = Math.round(point.main.temp);
    const rain = point.rain?.["3h"];
    const precipitation = rain ? `${rain} mm` : `0 mm`;

    forecast.push({
      source,
      timestamp,
      description,
      temperature,
      precipitation,
    });

    // Fake next two hours, because the free OWM api call only returns data for three hour intervals
    forecast.push({
      source,
      timestamp: addHours(timestamp, 1),
      description,
      temperature,
      precipitation,
    });
    forecast.push({
      source,
      timestamp: addHours(timestamp, 2),
      description,
      temperature,
      precipitation,
    });
  }

  return forecast;
}

function getSunData(owmJson: string): SunData | null {
  const data = JSON.parse(owmJson) as OwmApiResponse;
  if (!data.city) {
    return null;
  }
  const resp: SunData = { dates: [] };
  const now = new Date();
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const date = addDays(now, dayOffset);
    const sunrise = addDays(new Date(data.city.sunrise * 1000), dayOffset);
    const sunset = addDays(new Date(data.city.sunset * 1000), dayOffset);
    resp.dates.push({
      date,
      sunset,
      sunrise,
    });
  }
  return resp;
}

function parseWithTimeZone(
  dateStr: string,
  formatStr: string,
  referenceDate: Date,
  timeZone: string,
  parseOptions?: {
    locale?: Locale;
  }
) {
  // const zonedDate = utcToZonedTime(referenceDate, timeZone);
  const zonedDate = toZonedTime(referenceDate, timeZone);
  const parsedDate = parse(dateStr, formatStr, zonedDate, parseOptions);
  // return zonedTimeToUtc(parsedDate, timeZone);
  return fromZonedTime(parsedDate, timeZone);
}

export {
  getDmiWeather,
  getOwmWeather,
  getSunData,
  getTv2Weather,
  getYrApiWeather,
  getYrWeather,
};
