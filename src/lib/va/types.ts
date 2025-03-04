export interface WeatherForecast {
  source: string;
  timestamp: Date | string;
  description: string;
  temperature: number;
  precipitation: string;
}

export interface SunData {
  dates: {
    date: Date;
    sunset: Date;
    sunrise: Date;
  }[];
}
