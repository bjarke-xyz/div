export interface WeatherForecast {
  source: string;
  timestamp: string;
  description: string;
  temperature: number;
  precipitation: string;
}

export interface AveragedWeatherForecast extends WeatherForecast {
  iconUrl: string;
  entries: WeatherForecast[];
  lowTemperature: number | null;
  highTemperature: number | null;
}

export type WeatherForecastSites<T = unknown> = {
  tv2: T;
  dmi: T;
  yr: T;
  owm: T;
};

export type WeatherForecastResponse = WeatherForecastSites<WeatherForecast[]>;
export type WeatherForecastResponseSingle =
  WeatherForecastSites<WeatherForecast>;
