import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { WeatherForecast, WeatherForecastResponse } from "../types";
import { WeatherCell } from "./WeatherCell";

const TIMESTAMP_FORMAT = "dd-MM HH:mm";

export const WeatherGrid = ({ tv2, dmi, yr, owm }: WeatherForecastResponse) => {
  const [shortestDataset, setShortestDataset] = useState<WeatherForecast[]>([]);
  useEffect(() => {
    const orderedByLength = [tv2, dmi, yr, owm].sort(
      (a, b) => a.length - b.length
    );
    const shortestNonEmpty = orderedByLength.find((x) => x.length > 0);

    if (shortestNonEmpty) {
      setShortestDataset(shortestNonEmpty);
    }
  }, [dmi, owm, tv2, yr]);
  const types: (keyof WeatherForecast)[] = [
    "temperature",
    "description",
    "precipitation",
  ];

  return (
    <section>
      <table>
        <thead>
          <tr>
            <th>Dato</th>
            <th>Temperatur</th>
            <th>Beskrivelse</th>
            <th>Nedbør</th>
          </tr>
        </thead>
        <tbody style={{ fontFamily: "monospace" }}>
          {shortestDataset.map((_value, i) => (
            <tr key={i}>
              <td title={yr[i].timestamp}>
                {format(parseISO(yr[i].timestamp), TIMESTAMP_FORMAT)}
              </td>
              {types.map((type) => (
                <td key={type}>
                  <WeatherCell
                    type={type}
                    tv2={tv2[i]}
                    dmi={dmi[i]}
                    yr={yr[i]}
                    owm={owm[i]}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
