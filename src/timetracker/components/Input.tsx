import { css } from "@emotion/react";
import React, { useRef } from "react";
import { useStoreActions, useStoreState } from "../store/hooks";

export const Input: React.FC = () => {
  const tasks = useStoreState((state) => state.tasks);
  const actions = useStoreActions((actions) => actions);

  const durationInputs = useRef<(HTMLInputElement | null)[]>(
    Array.from(Array(tasks.length).map(() => null))
  );

  const onLabelChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const task = tasks[index];
    task.label = event.target.value;
    actions.update(task);
    actions.newIfNeeded();
  };

  const onDurationChange = (index: number, value: string) => {
    const task = tasks[index];
    const durationsStr = value;
    const durations = durationsStr.split(",");
    task.durations = durations;
    actions.update(task);
    actions.newIfNeeded();
  };

  return (
    <div
      css={css`
        margin-top: 0.2rem;
        display: flex;
        flex-direction: column;
      `}
    >
      <h3>Timetracker</h3>
      {tasks.map((task, i) => (
        <div
          key={task.id}
          css={css`
            padding: 0.6rem !important;
            flex-direction: row !important;
          `}
          className="row"
        >
          <button
            css={css`
              padding: 0 0.5rem !important;
            `}
            className="column column-5 button button-clear"
            title="Slet"
            onClick={() => actions.remove(task)}
          >
            🗑️
          </button>
          <input
            css={css`
              margin: 0 0.25rem !important;
            `}
            className="column column-15"
            placeholder="Opgave"
            value={task.label}
            tabIndex={0}
            onChange={(e) => onLabelChange(i, e)}
          ></input>
          <input
            ref={(el) => (durationInputs.current[i] = el)}
            className="column column-80"
            placeholder="8:00 9:00, 9:00 9:15"
            value={task.durations.join(",")}
            onChange={(e) => onDurationChange(i, e.target.value)}
          ></input>
        </div>
      ))}
      {tasks.length === 0 ? (
        <button
          css={css`
            margin-right: -0.85rem;
          `}
          className="button button-outline"
          onClick={() => actions.newTask()}
        >
          Tilføj
        </button>
      ) : null}
      {tasks.length > 0 ? (
        <button
          css={css`
            margin-right: -0.85rem;
          `}
          className="button button-outline"
          onClick={() => {
            if (confirm("Er du sikker?")) {
              actions.set([]);
            }
          }}
        >
          Slet alle
        </button>
      ) : null}
    </div>
  );
};
