import { Hono } from "hono";
import { EventsRepository } from "../lib/food-days/events-repository";
import { parsers } from "../lib/food-days/parsers";
import { getEnv } from "../lib/util";

export const foodDaysApi = new Hono();

foodDaysApi.get("/events", async (c) => {
  const eventsRepository = new EventsRepository(getEnv());
  let events = await eventsRepository.getEvents();
  if (events.length === 0) {
    await updateEvents(eventsRepository);
    events = await eventsRepository.getEvents();
  }
  if (events) {
    const todayOnly = c.req.query("today") === "true";
    if (todayOnly) {
      const today = new Date();
      events = events.filter((x) => {
        return (
          (x.date as Date).getMonth() === today.getMonth() &&
          (x.date as Date).getDate() === today.getDate()
        );
      });
    }
    return c.json(events);
  } else {
    return c.text("No events found", 404);
  }
});

async function updateEvents(eventsRepository: EventsRepository) {
  const parser = parsers["wikipedia"];
  const html = await (
    await fetch("https://en.wikipedia.org/wiki/List_of_food_days")
  ).text();
  const events = parser(html);
  await eventsRepository.writeEvents("wikipedia", events);
}
