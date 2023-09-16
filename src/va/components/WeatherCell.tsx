import {
  WeatherForecast,
  WeatherForecastResponseSingle,
  WeatherForecastSites,
} from "../types";

const Whitespace = ({ site, sites }: { site: string; sites: string[] }) => {
  const getSpaces = () => {
    const maxSiteLength = Math.max(...sites.map((x) => x.length));
    const spaces = maxSiteLength - site.length;
    return Math.max(spaces, 0);
  };
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: Array.from(Array(getSpaces())).map(() => "&nbsp;"),
      }}
    />
  );
};

const DescriptionCell = ({ values }: { values: CellValue }) => {
  const sites = Object.keys(values) as (keyof WeatherForecastSites)[];
  const getDescription = (site: keyof WeatherForecastSites) => {
    switch (site) {
      case "dmi":
        return (
          <img width="40px" src={`/api/va/proxy/dmi/symbol/${values[site]}`} />
        );
      case "yr":
        return (
          <img
            width="40px"
            title={values[site].toString()}
            src={`/va/img/yr/${values[site]}.png`}
          />
        );
      default:
        return values[site];
    }
  };
  return (
    <div>
      {sites.map((site, i) => (
        <div style={{ display: "flex", alignItems: "center" }} key={i}>
          <Whitespace site={site} sites={sites} />
          {site}:{getDescription(site)}
        </div>
      ))}
    </div>
  );
};

const TemperatureCell = ({ values }: { values: CellValue }) => {
  const sites = Object.keys(values) as (keyof WeatherForecastSites)[];
  const temperatures = Object.values(values) as number[];
  const max = Math.max(...temperatures);
  const min = Math.min(...temperatures);
  const average =
    temperatures.reduce((acc, curr) => acc + curr, 0) / temperatures.length;
  return (
    <div>
      <div>
        {sites.map((site, i) => (
          <div style={{ display: "flex", alignItems: "center" }} key={i}>
            <Whitespace site={site} sites={sites} />
            {site}: {values[site]}°
          </div>
        ))}
      </div>
      <div>
        <span>max: {max}°</span>, <span>min: {min}°</span>,{" "}
        <span>avg: {average.toFixed(2)}°</span>
      </div>
    </div>
  );
};

const PrecipitationCell = ({ values }: { values: CellValue }) => {
  const sites = Object.keys(values) as (keyof WeatherForecastSites)[];
  return (
    <div>
      {sites.map((site, i) => (
        <div style={{ display: "flex", alignItems: "center" }} key={i}>
          <Whitespace site={site} sites={sites} />
          {site}: {values[site]}
        </div>
      ))}
    </div>
  );
};

type CellValue = Record<keyof WeatherForecastSites, string | number>;

export const WeatherCell = ({
  type,
  ...sites
}: { type: keyof WeatherForecast } & WeatherForecastResponseSingle) => {
  const keys = Object.keys(sites) as (keyof WeatherForecastSites)[];

  const values = keys.reduce((acc, curr) => {
    if (sites[curr]) {
      acc[curr] = sites[curr][type];
    }
    return acc;
  }, {} as CellValue);

  const cells = {
    description: <DescriptionCell values={values} />,
    temperature: <TemperatureCell values={values} />,
    precipitation: <PrecipitationCell values={values} />,
  } as Record<keyof WeatherForecast, React.ReactElement>;
  const cell = cells[type];
  if (!cell) throw new Error(`${type} not supported`);

  return cell;
};
