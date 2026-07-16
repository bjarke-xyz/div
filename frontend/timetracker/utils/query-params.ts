import { Task } from "../store/models";
import { v4 as uuid } from "uuid";

// ?q=ged@8:22-9:00,9:15-12:18¤ost@9:00-9:15
export function parseQueryParams(): { q: Task[] | null } {
  const result: { q: Task[] | null } = { q: null };
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, "", window.location.pathname);

  const qStr = params.get("q");
  if (qStr) {
    const tasksStr = qStr.split("¤");
    const tasksParsed: Task[] = tasksStr.map((taskStr) => {
      const [label, times] = taskStr.split("@");
      const durations = times.split(",").map((fromTo) => {
        return fromTo.split("-").join(" ");
      });
      return {
        label,
        durations,
        id: uuid(),
      };
    });
    result.q = tasksParsed;
  }
  return result;
}
