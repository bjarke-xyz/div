import {
  format,
  isBefore,
  isSameDay,
  isSameHour,
  isToday,
  parse,
  parseISO,
  startOfDay,
  startOfHour,
} from "date-fns";
import { da } from "date-fns/locale";
import { flatten, max, min, sum } from "lodash";
import { PropsWithChildren, useRef } from "react";
import { useDraggable } from "react-use-draggable-scroll";
import useSWR from "swr";
import { fetcher } from "../../utils/fetcher";
import {
  AveragedWeatherForecast,
  SunDataResponse,
  WeatherForecast,
  WeatherForecastResponse,
} from "../types";

function getShortestDataSet(
  weatherForecast: WeatherForecastResponse
): WeatherForecast[] {
  const orderedByLength = Object.values(weatherForecast).sort(
    (a, b) => a.length - b.length
  );
  const shortestNonEmpty = orderedByLength.find((x) => x.length > 0) ?? [];
  return shortestNonEmpty;
}

function getLongestDataSet(
  weatherForecast: WeatherForecastResponse
): WeatherForecast[] {
  const orderedByLength = Object.values(weatherForecast).sort(
    (a, b) => b.length - a.length
  );
  const longestNonEmpty = orderedByLength.find((x) => x.length > 0) ?? [];
  return longestNonEmpty;
}

function getIconUrl(entry: WeatherForecast | null): string | null {
  if (!entry) return null;
  switch (entry.source.toLowerCase()) {
    case "dmi":
      return `/api/va/proxy/dmi/symbol/${entry.description}`;
    case "yr":
      return `/va/img/yr/${entry.description}.png`;
    default:
      return null;
  }
}

function getDescription(entry: WeatherForecast | null): string | null {
  if (!entry) return null;
  switch (entry.source.toLowerCase()) {
    case "owm":
      return entry.description;
    default:
      return null;
  }
}

function getAverage(entries: WeatherForecast[]): AveragedWeatherForecast {
  const nonNullEntries = entries.filter((x) => !!x);
  const iconUrl = nonNullEntries
    .map((x) => getIconUrl(x))
    .filter((x) => x !== null)[0];
  const description = nonNullEntries
    .map((x) => getDescription(x))
    .filter((x) => x !== null)[0];
  const firstNonNull = nonNullEntries[0] ?? {};
  const temperatures = nonNullEntries.map((x) => x.temperature);
  return {
    ...firstNonNull,
    temperature: Math.round(sum(temperatures) / nonNullEntries.length),
    iconUrl: iconUrl ?? "",
    description: description ?? "",
    entries: nonNullEntries,
    lowTemperature: min(temperatures) ?? null,
    highTemperature: max(temperatures) ?? null,
  };
}

function getHourlyWeather(
  weatherForecast: WeatherForecastResponse,
  now: Date
): AveragedWeatherForecast[] {
  const shortest = getShortestDataSet(weatherForecast);
  const lists = Object.values(weatherForecast);
  const response: AveragedWeatherForecast[] = [];
  for (let i = 0; i < shortest.length; i++) {
    const entries = lists
      .filter((lists) => lists.length > 0)
      .map((lists) => lists[i]);
    const average = getAverage(entries);
    if (isBefore(parseISO(average.timestamp), startOfHour(now))) {
      continue;
    }
    response.push(average);
  }
  if (response.length > 25) {
    response.length = 25;
  }
  return response;
}

function getDailyWeather(
  weatherForecast: WeatherForecastResponse,
  now: Date
): AveragedWeatherForecast[] {
  const longest = getLongestDataSet(weatherForecast);
  const lists = Object.values(weatherForecast);
  const entriesByDate: Record<string, WeatherForecast[]> = {};
  for (let i = 0; i < longest.length; i++) {
    const entries = lists
      .filter((lists) => lists.length > 0)
      .map((lists) => lists[i]);
    const nonNullEntries = entries.filter((x) => !!x);
    for (const entry of nonNullEntries) {
      const dateStr = entry.timestamp.split("T")[0];
      if (!entriesByDate[dateStr]) {
        entriesByDate[dateStr] = [];
      }
      entriesByDate[dateStr].push(entry);
    }
  }
  const response: AveragedWeatherForecast[] = [];
  const nowStartOfDay = startOfDay(now);
  for (const date in entriesByDate) {
    const parsedDate = parse(date, "dd-MM-yyyy", now);
    if (isBefore(parsedDate, nowStartOfDay)) {
      continue;
    }
    const entries = entriesByDate[date];
    const average = getAverage(entries);
    response.push(average);
  }
  if (response.length > 10) {
    response.length = 10;
  }
  return response;
}

export interface WeatherPageProps {
  city: string;
}
export const WeatherPage: React.FC<WeatherPageProps> = ({ city }) => {
  const { data, error, isLoading } = useSWR<WeatherForecastResponse>(
    `/api/va/weather?city=${city}`,
    fetcher
  );
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>error: {error}</p>;
  if (!data) return <p>no data?</p>;
  const now = new Date();
  const hourlyWeather = getHourlyWeather(data, now);
  const dailyWeather = getDailyWeather(data, now);
  return (
    <main className="flex flex-col max-w-lg mt-4 rounded-lg mx-auto text-xl py-4 bg-blue-50">
      <div className="flex flex-col mx-auto items-center">
        <h1 className="text-3xl">{city}</h1>
        <div className="text-7xl">{hourlyWeather[0].temperature}°</div>
        <div className="text-2xl">
          <span>{hourlyWeather[0].description}</span>
        </div>
        <div className="text-2xl">
          <span>H: 22° L: 13°</span>
        </div>
      </div>
      <HourlyWeatherContainer
        weatherForecast={hourlyWeather}
        now={now}
        city={city}
      />
      <DailyWeatherContainer weatherForecast={dailyWeather} now={now} />
    </main>
  );
};

const MutedText: React.FC<{ text: string; className?: string }> = ({
  text,
  className,
}) => {
  return <span className={`text-blue-100 ${className}`}>{text}</span>;
};

interface DailyWeatherContainerProps {
  weatherForecast: AveragedWeatherForecast[];
  now: Date;
}
const DailyWeatherContainer: React.FC<DailyWeatherContainerProps> = ({
  weatherForecast,
  now,
}) => {
  return (
    <WeatherBlock>
      <div className="flex">
        <span className="mr-1">📆</span>
        <MutedText
          text={`Vejrudsigt for de næste ${weatherForecast.length} dage`}
          className="uppercase"
        />
      </div>
      <div className="grid mt-4 gap-y-4 grid-cols-5">
        {weatherForecast.map((wf, i) => (
          <div key={i} className="contents">
            <DailyWeather
              now={now}
              date={parseISO(wf.timestamp)}
              lowTemperature={wf.lowTemperature}
              highTemperature={wf.highTemperature}
              icon={wf.iconUrl}
              eachElemClassName="border-b border-blue-50/50 py-2"
            />
          </div>
        ))}
      </div>
    </WeatherBlock>
  );
};

interface DailyWeatherProps {
  date: Date;
  now: Date;
  lowTemperature: number | null;
  highTemperature: number | null;
  icon: string;
  eachElemClassName: string;
}
const DailyWeather: React.FC<DailyWeatherProps> = ({
  date,
  now,
  lowTemperature,
  highTemperature,
  icon,
  eachElemClassName,
}) => {
  const day = isSameDay(date, now)
    ? "I dag"
    : `${format(date, "eee", { locale: da })}`;
  return (
    <>
      <div className={eachElemClassName}>{day}</div>
      <div className={eachElemClassName}>
        <img src={icon} className="min-w-[40px] max-w-[40px]" />
      </div>
      <div className={eachElemClassName}>
        <MutedText text={`${lowTemperature}°`} />
      </div>
      <div className={eachElemClassName}>-----</div>
      <div className={eachElemClassName}>{highTemperature}°</div>
    </>
  );
};

interface HourlyWeatherContainerProps {
  weatherForecast: AveragedWeatherForecast[];
  now: Date;
  city: string;
}
const HourlyWeatherContainer: React.FC<HourlyWeatherContainerProps> = ({
  weatherForecast,
  now,
  city,
}) => {
  const ref =
    useRef<HTMLDivElement>() as React.MutableRefObject<HTMLInputElement>;
  const { events } = useDraggable(ref);
  const { data, error } = useSWR<SunDataResponse>(
    `/api/va/sun?city=${city}&v=3`,
    fetcher
  );
  if (error) {
    console.log("failed to load sun data", error);
  }
  const hourlyWeatherElems: React.ReactElement[] = flatten(
    weatherForecast.map((wf, i) => {
      const elems = [
        <HourlyWeather
          key={wf.timestamp}
          time={parseISO(wf.timestamp)}
          icon={wf.iconUrl}
          temperature={wf.temperature}
          now={now}
        />,
      ];
      if (data?.dates && data?.dates?.length > 0) {
        for (const date of data.dates) {
          const sunrise = parseISO(date.sunrise);
          const sunset = parseISO(date.sunset);
          const nextWfTimestamp = weatherForecast[i + 1]?.timestamp;
          const nextWfTimestampDate = nextWfTimestamp
            ? parseISO(nextWfTimestamp)
            : null;
          if (nextWfTimestamp) {
            const wfTimestampDate = parseISO(wf.timestamp);
            if (nextWfTimestampDate) {
              if (sunrise > wfTimestampDate && sunrise < nextWfTimestampDate) {
                elems.push(
                  <HourlyWeather
                    key={sunrise.toISOString()}
                    time={sunrise}
                    icon="🌅"
                    temperature={wf.temperature}
                    type="sunrise"
                    now={now}
                  />
                );
              } else if (
                sunset > wfTimestampDate &&
                sunset < nextWfTimestampDate
              ) {
                elems.push(
                  <HourlyWeather
                    key={sunset.toISOString()}
                    time={sunset}
                    icon="🌇"
                    temperature={wf.temperature}
                    type="sunset"
                    now={now}
                  />
                );
              }
            }
          }
        }
      }
      return elems;
    })
  );
  // if (isLoading) return <p>Loading...</p>;
  // if (error) return <p>error: {error}</p>;
  // if (!data) return <p>no data?</p>;
  return (
    <WeatherBlock>
      <div
        className="flex flex-row gap-8 overflow-auto no-scrollbar select-none"
        {...events}
        ref={ref}
      >
        {hourlyWeatherElems}
      </div>
    </WeatherBlock>
  );
};

interface HourlyWeatherProps {
  time: Date;
  icon: string;
  temperature: number;
  type?: "sunrise" | "sunset";
  now: Date;
}
const HourlyWeather: React.FC<HourlyWeatherProps> = ({
  time,
  icon,
  temperature,
  type,
  now,
}) => {
  let tempElem = <span>{temperature}°</span>;
  let iconElem = <img src={icon} className="min-w-[40px]" />;
  switch (type) {
    case "sunrise":
      tempElem = <span>Solopgang</span>;
      iconElem = <span className="h-[40px]">🌅</span>;
      break;
    case "sunset":
      tempElem = <span>Solnedgang</span>;
      iconElem = <span className="h-[40px]">🌆</span>;
      break;
  }
  let timeFormat = "HH";
  if (type === "sunset" || type === "sunrise") {
    timeFormat = "HH:mm";
  }

  return (
    <div className="flex flex-col items-center">
      <span>
        {isToday(time) && isSameHour(now, time) && !type
          ? "Nu"
          : format(time, timeFormat)}
      </span>
      {iconElem}
      {tempElem}
    </div>
  );
};

const WeatherBlock: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="flex flex-col rounded-lg bg-blue-400 text-white mt-8 mx-8 p-4">
      {children}
    </div>
  );
};
