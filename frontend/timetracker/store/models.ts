import { Action } from "easy-peasy";

export interface Task {
  id: string;
  label: string;
  durations: string[];
}

export interface StoreModel {
  tasks: Task[];
  add: Action<StoreModel, Task>;
  newTask: Action<StoreModel>;
  newIfNeeded: Action<StoreModel>;
  update: Action<StoreModel, Task>;
  remove: Action<StoreModel, Task>;
  set: Action<StoreModel, Task[]>;
}
