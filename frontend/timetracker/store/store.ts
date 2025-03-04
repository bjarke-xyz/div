import { action, createStore, persist } from "easy-peasy";
import { v4 } from "uuid";
import { StoreModel } from "./models";

export const store = createStore<StoreModel>(
  persist(
    {
      tasks: [],
      add: action((state, payload) => {
        state.tasks.push(payload);
      }),
      newTask: action((state) => {
        state.tasks.push({ id: v4(), label: "", durations: [] });
      }),
      newIfNeeded: action((state) => {
        if (state.tasks.every((x) => x.label)) {
          state.tasks.push({ id: v4(), label: "", durations: [] });
        }
      }),
      update: action((state, payload) => {
        const index = state.tasks.findIndex((x) => x.id === payload.id);
        if (index !== -1) {
          const before = state.tasks
            .slice(0, index)
            .filter((x) => x.id !== payload.id);
          const after = state.tasks.slice(index + 1);
          state.tasks = [...before, payload, ...after];
        } else {
          state.tasks.push(payload);
        }
      }),
      remove: action((state, payload) => {
        const index = state.tasks.findIndex((x) => x.id === payload.id);
        if (index !== -1) {
          state.tasks.splice(index, 1);
        }
      }),
      set: action((state, payload) => {
        state.tasks = payload;
      }),
    },
    { storage: "localStorage" }
  )
);
