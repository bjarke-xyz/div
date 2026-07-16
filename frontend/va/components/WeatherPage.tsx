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
import { flatten, max, mean, min, orderBy, sum } from "lodash";
import { PropsWithChildren, useRef, useState } from "react";
import Drawer from "react-modern-drawer";
import { useDraggable } from "react-use-draggable-scroll";
import useSWR from "swr";
import { fetcher } from "../../lib/fetcher";
import {
  AveragedWeatherForecast,
  SunDataResponse,
  WeatherForecast,
  WeatherForecastResponse,
} from "../types";

// Source color mapping
const SOURCE_COLORS = {
  tv2: { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500", name: "TV2" },
  dmi: { bg: "bg-green-500", text: "text-green-500", border: "border-green-500", name: "DMI" },
  yr: { bg: "bg-purple-500", text: "text-purple-500", border: "border-purple-500", name: "YR" },
  owm: { bg: "bg-orange-500", text: "text-orange-500", border: "border-orange-500", name: "OWM" },
} as const;

type SourceKey = keyof typeof SOURCE_COLORS;

// Calculate consensus level based on temperature variance
function calculateConsensus(temperatures: number[]): {
  level: "high" | "medium" | "low";
  variance: number;
  color: string;
} {
  if (temperatures.length < 2) {
    return { level: "high", variance: 0, color: "text-green-500" };
  }
  const avg = mean(temperatures);
  const variance = Math.sqrt(
    sum(temperatures.map((t) => Math.pow(t - avg, 2))) / temperatures.length
  );

  if (variance < 2) {
    return { level: "high", variance, color: "text-green-500" };
  } else if (variance < 4) {
    return { level: "medium", variance, color: "text-yellow-500" };
  } else {
    return { level: "low", variance, color: "text-red-500" };
  }
}

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
      return `/api/va/proxy/dmi/symbol/${entry.description}/icon.svg`;
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
  if (error) return <p>error: {error}</p>;
  const now = new Date();
  const hourlyWeather = data ? getHourlyWeather(data, now) : [];
  const dailyWeather = data ? getDailyWeather(data, now) : [];

  // Get current weather from all sources
  const currentFromSources = hourlyWeather?.[0]?.entries ?? [];
  const currentTemp = hourlyWeather?.[0]?.temperature;
  const currentDescription = hourlyWeather?.[0]?.description;

  return (
    <main className="flex flex-col max-w-4xl mt-4 rounded-lg mx-auto text-xl py-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <h1 className="text-4xl font-bold text-center mb-8 text-slate-800">
        {isLoading ? "Loading..." : city}
      </h1>

      {/* Hero Section with Source Comparison */}
      <div className="flex flex-col items-center mb-8 px-8">
        {/* Grid layout with center and sources */}
        <div className="grid grid-cols-3 gap-6 items-center mb-8 w-full max-w-2xl">
          {/* Top source */}
          {currentFromSources[0] && (
            <div className="col-start-2 flex justify-center">
              <SourceCard source={currentFromSources[0]} />
            </div>
          )}

          {/* Left source */}
          {currentFromSources[3] && (
            <div className="row-start-2 col-start-1 flex justify-end">
              <SourceCard source={currentFromSources[3]} />
            </div>
          )}

          {/* Center - Average temperature */}
          <div className="row-start-2 col-start-2 flex flex-col items-center bg-white rounded-2xl shadow-xl p-8 border-4 border-slate-300">
            <div className="text-7xl font-bold text-slate-800">
              {currentTemp ?? "??"}°
            </div>
            <div className="text-sm text-slate-500 uppercase tracking-wide mt-2">Gennemsnit</div>
          </div>

          {/* Right source */}
          {currentFromSources[1] && (
            <div className="row-start-2 col-start-3 flex justify-start">
              <SourceCard source={currentFromSources[1]} />
            </div>
          )}

          {/* Bottom source */}
          {currentFromSources[2] && (
            <div className="row-start-3 col-start-2 flex justify-center">
              <SourceCard source={currentFromSources[2]} />
            </div>
          )}
        </div>

        <div className="text-xl text-slate-700 mb-2">{currentDescription}</div>

        {/* Consensus Indicator */}
        <ConsensusIndicator entries={currentFromSources} />

        <div className="text-lg text-slate-600 mt-4">
          <span>H: {dailyWeather?.[0]?.highTemperature ?? "??"}°</span>
          <span className="mx-2">•</span>
          <span>L: {dailyWeather?.[0]?.lowTemperature ?? "??"}°</span>
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

// Component to show individual source card
const SourceCard: React.FC<{ source: WeatherForecast }> = ({ source }) => {
  const sourceKey = source.source.toLowerCase() as SourceKey;
  const colors = SOURCE_COLORS[sourceKey];

  return (
    <div className={`flex flex-col items-center bg-white rounded-xl shadow-md p-4 border-2 ${colors.border}`}>
      <div className={`text-2xl font-bold ${colors.text}`}>
        {source.temperature}°
      </div>
      <div className="text-xs text-slate-500 uppercase tracking-wide mt-1">
        {colors.name}
      </div>
    </div>
  );
};

// Consensus indicator component
const ConsensusIndicator: React.FC<{ entries: WeatherForecast[] }> = ({ entries }) => {
  const temperatures = entries.map((e) => e.temperature);
  const consensus = calculateConsensus(temperatures);

  const labels = {
    high: "Høj enighed",
    medium: "Moderat enighed",
    low: "Lav enighed",
  };

  const icons = {
    high: "✓",
    medium: "~",
    low: "!",
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`font-bold ${consensus.color}`}>
        {icons[consensus.level]}
      </span>
      <span className="text-slate-600">{labels[consensus.level]}</span>
      <span className="text-slate-400 text-xs">
        (±{consensus.variance.toFixed(1)}°)
      </span>
    </div>
  );
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
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">📆</span>
        <h2 className="text-lg font-semibold text-slate-700">
          Vejrudsigt for de næste {weatherForecast.length} dage
        </h2>
      </div>
      <div className="flex flex-col gap-y-3">
        {weatherForecast.map((wf) => (
          <DailyWeather
            key={wf.timestamp}
            now={now}
            date={parseISO(wf.timestamp)}
            lowTemperature={wf.lowTemperature}
            highTemperature={wf.highTemperature}
            icon={wf.iconUrl}
            wf={wf}
          />
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
  wf: AveragedWeatherForecast;
}
const DailyWeather: React.FC<DailyWeatherProps> = ({
  date,
  now,
  lowTemperature,
  highTemperature,
  icon,
  wf,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleDrawer = () => setIsOpen((prevState) => !prevState);
  const day = isSameDay(date, now)
    ? "I dag"
    : format(date, "eeee", { locale: da });

  // Group entries by source to get min/max for each
  const sourceRanges: Record<string, { min: number; max: number }> = {};
  wf.entries.forEach((entry) => {
    const source = entry.source.toLowerCase();
    if (!sourceRanges[source]) {
      sourceRanges[source] = { min: entry.temperature, max: entry.temperature };
    } else {
      sourceRanges[source].min = Math.min(sourceRanges[source].min, entry.temperature);
      sourceRanges[source].max = Math.max(sourceRanges[source].max, entry.temperature);
    }
  });

  // Calculate global min/max for scaling
  const allTemps = Object.values(sourceRanges).flatMap((r) => [r.min, r.max]);
  const globalMin = Math.min(...allTemps);
  const globalMax = Math.max(...allTemps);
  const tempRange = globalMax - globalMin || 10;

  const consensus = calculateConsensus(wf.entries.map((e) => e.temperature));

  return (
    <>
      <button
        className="flex flex-col p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        onClick={toggleDrawer}
      >
        {/* Top row: Day, Icon, Temps */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1">
            <span className="font-semibold text-slate-800 min-w-[100px] capitalize">
              {day}
            </span>
            <img src={icon} className="min-w-[40px] max-w-[40px]" />
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs ${consensus.color}`}>
              {consensus.level === "high" ? "✓" : consensus.level === "medium" ? "~" : "!"}
            </span>
            <span className="text-slate-500">{lowTemperature}°</span>
            <span className="text-slate-800 font-bold">{highTemperature}°</span>
          </div>
        </div>

        {/* Temperature bands visualization */}
        <div className="flex flex-col gap-1.5">
          {Object.entries(sourceRanges).map(([source, range]) => {
            const sourceKey = source as SourceKey;
            const colors = SOURCE_COLORS[sourceKey];
            const startPercent = ((range.min - globalMin) / tempRange) * 100;
            const widthPercent = ((range.max - range.min) / tempRange) * 100;

            return (
              <div key={source} className="flex items-center gap-2">
                <span className={`text-xs ${colors.text} font-medium min-w-[35px]`}>
                  {colors.name}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full relative">
                  <div
                    className={`absolute h-full ${colors.bg} rounded-full`}
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(widthPercent, 5)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-slate-500 min-w-[50px] text-right">
                  {range.min}° - {range.max}°
                </span>
              </div>
            );
          })}
        </div>
      </button>
      <SourcesSummary
        open={isOpen}
        onClose={toggleDrawer}
        weatherForecast={[wf]}
      />
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
  const ref = useRef<HTMLDivElement | null>(
    null
  ) as React.MutableRefObject<HTMLInputElement>;
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
          wf={wf}
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
              if (
                sunrise > now &&
                sunrise > wfTimestampDate &&
                sunrise < nextWfTimestampDate
              ) {
                elems.push(
                  <HourlyWeather
                    key={sunrise.toISOString()}
                    time={sunrise}
                    icon="🌅"
                    temperature={wf.temperature}
                    type="sunrise"
                    now={now}
                    wf={null}
                  />
                );
              } else if (
                sunset > now &&
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
                    wf={null}
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
  return (
    <WeatherBlock>
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">⏰</span>
        <h2 className="text-lg font-semibold text-slate-700">
          Time for time vejrudsigt
        </h2>
      </div>
      <div
        className="flex flex-row gap-4 overflow-auto no-scrollbar select-none"
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
  wf: AveragedWeatherForecast | null;
}
const HourlyWeather: React.FC<HourlyWeatherProps> = ({
  time,
  icon,
  temperature,
  type,
  now,
  wf,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleDrawer = () => setIsOpen((prevState) => !prevState);

  // Handle sunrise/sunset differently
  if (type === "sunrise" || type === "sunset") {
    const timeFormat = "HH:mm";
    return (
      <div className="flex flex-col items-center p-2 min-w-[80px]">
        <span className="text-sm">{format(time, timeFormat)}</span>
        <span className="h-[40px] text-2xl">{type === "sunrise" ? "🌅" : "🌆"}</span>
        <span className="text-xs text-slate-500">
          {type === "sunrise" ? "Solopgang" : "Solnedgang"}
        </span>
      </div>
    );
  }

  const timeFormat = "HH";
  const sources = wf?.entries ?? [];
  const temperatures = sources.map((s) => s.temperature);
  const consensus = calculateConsensus(temperatures);

  return (
    <button
      className="flex flex-col items-center p-3 hover:bg-slate-200 rounded-lg transition-colors min-w-[80px]"
      disabled={!wf}
      onClick={toggleDrawer}
    >
      <span className="text-sm font-medium mb-2">
        {isToday(time) && isSameHour(now, time) ? "Nu" : format(time, timeFormat)}
      </span>

      {/* Mini bar chart of sources */}
      <div className="flex items-end gap-1 h-12 mb-2">
        {sources.map((source) => {
          const sourceKey = source.source.toLowerCase() as SourceKey;
          const colors = SOURCE_COLORS[sourceKey];
          const maxTemp = Math.max(...temperatures, temperature + 5);
          const minTemp = Math.min(...temperatures, temperature - 5);
          const range = maxTemp - minTemp || 10;
          const height = ((source.temperature - minTemp) / range) * 100;

          return (
            <div
              key={source.source}
              className={`w-3 ${colors.bg} rounded-t`}
              style={{ height: `${Math.max(height, 20)}%` }}
              title={`${colors.name}: ${source.temperature}°`}
            />
          );
        })}
      </div>

      {/* Weather icon */}
      <WeatherIcon url={icon} />

      {/* Average temperature with consensus indicator */}
      <div className="flex items-center gap-1 mt-1">
        <span className="font-bold">{temperature}°</span>
        <span className={`text-xs ${consensus.color}`}>{consensus.level === "high" ? "✓" : consensus.level === "medium" ? "~" : "!"}</span>
      </div>

      {wf && (
        <SourcesSummary
          open={isOpen}
          onClose={toggleDrawer}
          weatherForecast={[wf]}
        />
      )}
    </button>
  );
};

const WeatherIcon = ({ url }: { url: string }) => {
  return <img src={url} className="min-w-[40px] max-w-[40px]" />;
};

const WeatherBlock: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="flex flex-col rounded-xl bg-white shadow-lg mt-8 mx-8 p-6 border border-slate-200">
      {children}
    </div>
  );
};

interface SourcesSummaryProps {
  weatherForecast: AveragedWeatherForecast[];
  open: boolean;
  onClose: () => void | undefined;
}
const SourcesSummary: React.FC<SourcesSummaryProps> = ({
  weatherForecast,
  open,
  onClose,
}) => {
  if (open) {
    console.log(weatherForecast);
  }
  const orderedWeatherForecast = orderBy(
    weatherForecast.flatMap((x) => x.entries),
    ["timestamp", "source"]
  );
  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        direction="bottom"
        size="70vh"
        className="h-full overflow-scroll bg-slate-50"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-slate-800">Kilde detaljer</h3>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 text-3xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-700 text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tid</th>
                  <th className="px-4 py-3 text-left font-semibold">Kilde</th>
                  <th className="px-4 py-3 text-left font-semibold">Temperatur</th>
                  <th className="px-4 py-3 text-left font-semibold">Beskrivelse</th>
                  <th className="px-4 py-3 text-left font-semibold">Nedbør</th>
                </tr>
              </thead>
              <tbody>
                {orderedWeatherForecast.map((wf, i) => {
                  const sourceKey = wf.source.toLowerCase() as SourceKey;
                  const colors = SOURCE_COLORS[sourceKey];
                  return (
                    <tr
                      key={`${wf.timestamp}:${wf.source}`}
                      className={`${
                        i % 2 === 1 ? "bg-white" : "bg-slate-100"
                      } border-b border-slate-200`}
                    >
                      <td className="px-4 py-3 text-slate-700">
                        {format(parseISO(wf.timestamp), "dd/MM HH:mm")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${colors.text} font-semibold`}>
                          {colors.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {wf.temperature}°
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getIconUrl(wf) ? (
                            <WeatherIcon url={getIconUrl(wf)!} />
                          ) : (
                            <span className="text-slate-600">{wf.description}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{wf.precipitation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Drawer>
    </>
  );
};
