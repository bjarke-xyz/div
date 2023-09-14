import { FoodDaysEnv } from "../../lib/food-days/env";
import { EventsRepository } from "../../lib/food-days/events-repository";
import { parsers } from "../../lib/food-days/parsers";

async function updateEvents(eventsRepository: EventsRepository) {
  const parser = parsers["wikipedia"];
  const html = await (
    await fetch("https://en.wikipedia.org/wiki/List_of_food_days")
  ).text();
  const events = parser(html);
  await eventsRepository.writeEvents("wikipedia", events);
}

export const onRequest: PagesFunction<FoodDaysEnv> = async (context) => {
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = await caches.open("default");

  let response = await cache.match(cacheKey);
  if (!response) {
    const eventsRepository = new EventsRepository(context.env);
    // Not in cache, fetch from origin
    let events = await eventsRepository.getEvents();
    if (events.length === 0) {
      await updateEvents(eventsRepository);
      events = await eventsRepository.getEvents();
    }
    if (events) {
      const queryParams = new URL(context.request.url).searchParams;
      const todayOnly = queryParams.get("today") === "true";
      if (todayOnly) {
        const today = new Date();
        events = events.filter((x) => {
          return (
            (x.date as Date).getMonth() === today.getMonth() &&
            (x.date as Date).getDate() === today.getDate()
          );
        });
      }
      response = new Response(JSON.stringify(events), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      response = new Response("No events found", { status: 404 });
    }

    response.headers.append("Cache-Control", "s-maxage=600");
    response.headers.append("Access-Control-Allow-Origin", "*");
    context.waitUntil(cache.put(cacheKey, response.clone()));
  }
  return response;
};
