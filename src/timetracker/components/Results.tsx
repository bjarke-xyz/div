import { css } from "@emotion/react";
import React, { useEffect, useState } from "react";
import { useStoreState } from "../store/hooks";

const ERROR = "FEJL";

function convertToString(ms: number | null, delim = ":") {
  if (ms === null) {
    return ERROR;
  }
  const showWith0 = (value: number) => (value < 10 ? `0${value}` : value);
  const hours = showWith0(Math.floor((ms / (1000 * 60 * 60)) % 60));
  const minutes = showWith0(Math.floor((ms / (1000 * 60)) % 60));
  const seconds = showWith0(Math.floor((ms / 1000) % 60));
  if (
    isNaN(parseInt(hours.toString())) ||
    isNaN(parseInt(minutes.toString())) ||
    isNaN(parseInt(seconds.toString()))
  ) {
    return ERROR;
  }
  return `${hours}${delim}${minutes}${delim}${seconds}`;
}

function convertToHours(ms: number | null): string {
  if (ms === null) {
    return ERROR;
  }

  const hours = ms / 3600000;
  if (isNaN(hours)) {
    return ERROR;
  }
  return hours.toFixed(2);
}

function sum(xs: number[]) {
  return xs.reduce((prev, curr) => prev + curr, 0);
}

export const Results: React.FC = () => {
  const tasks = useStoreState((x) => x.tasks);

  const [processedTasks, setProcessedTasks] = useState<
    {
      label: string;
      durationHHMMSS: string;
      durationHours: string;
      durationMs: number;
    }[]
  >([]);

  useEffect(() => {
    const tmpProcessedTasks: {
      label: string;
      durationHHMMSS: string;
      durationHours: string;
      durationMs: number;
    }[] = tasks
      .filter((x) => x.label)
      .map((task) => {
        const dates: {
          from: Date | null;
          to: Date | null;
        }[] = task.durations.map((duration) => {
          try {
            const [from, to] = duration
              .trim()
              .split(" ")
              .map((x) => x.trim());

            const [fromHour, fromMinute] = from
              .split(":")
              .map((x) => x.trim())
              .map(Number);
            const fromDate = new Date();
            fromDate.setHours(fromHour);
            fromDate.setMinutes(fromMinute);
            fromDate.setSeconds(0);
            fromDate.setMilliseconds(0);

            const [toHour, toMinute] = to
              .split(":")
              .map((x) => x.trim())
              .map(Number);
            const toDate = new Date();
            toDate.setHours(toHour);
            toDate.setMinutes(toMinute);
            toDate.setSeconds(0);
            toDate.setMilliseconds(0);

            return { from: fromDate, to: toDate };
          } catch (err) {
            return { from: null, to: null };
          }
        });

        const msDurations = dates.map(({ from, to }) => {
          if (
            !(
              from !== null &&
              from instanceof Date &&
              to !== null &&
              to instanceof Date
            )
          ) {
            return null;
          }

          const diff = to.getTime() - from.getTime();
          return diff;
        });

        const msDuration = msDurations.reduce(
          (prev, curr) => (prev ?? 0) + (curr ?? 0),
          0
        );

        const hhmmss = convertToString(msDuration);
        const hours = convertToHours(msDuration);
        return {
          label: task.label,
          durationHHMMSS: hhmmss,
          durationHours: hours,
          durationMs: msDuration ?? 0,
        };
      });
    setProcessedTasks(tmpProcessedTasks);
  }, [tasks]);

  return (
    <div>
      <table
        css={css`
          display: table;
        `}
      >
        <thead>
          <tr>
            <th>Opgave</th>
            <th>Timer</th>
            <th>HH:MM:SS</th>
          </tr>
        </thead>
        <tbody>
          {processedTasks.map((task, i) => (
            <tr key={i}>
              <td>{task.label}</td>
              <td>{task.durationHours}</td>
              <td>{task.durationHHMMSS}</td>
            </tr>
          ))}
          <tr>
            <td>I alt</td>
            <td>
              {convertToHours(sum(processedTasks.map((x) => x.durationMs)))}
            </td>
            <td>
              {convertToString(sum(processedTasks.map((x) => x.durationMs)))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
