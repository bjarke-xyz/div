export interface WeatherForecast {
  source: string;
  timestamp: string;
  description: string;
  temperature: number;
  precipitation: string;
}

export type WeatherForecastResponse = {
  tv2: WeatherForecast[];
  dmi: WeatherForecast[];
  yr: WeatherForecast[];
  owm: WeatherForecast[];
};

export type WeatherForecastResponseSingle = {
  tv2: WeatherForecast;
  dmi: WeatherForecast;
  yr: WeatherForecast;
  owm: WeatherForecast;
};
