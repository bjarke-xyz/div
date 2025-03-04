import { load } from "cheerio";
import { parse } from "date-fns";
import { orderBy } from "lodash";
import { DayEvent, SourceType } from "./models";

type ParseFunction = (html: string) => DayEvent[];

function parseWikipedia(html: string): DayEvent[] {
  const $ = load(html);
  const events: DayEvent[] = [];
  $("h2 > .mw-headline").each((_i, elem) => {
    const ch = $(elem);
    let country = ch.text().trim();
    if (country === "Global or International") {
      country = "International";
    }
    let tables = ch.parent().nextAll("table").toArray();
    if (country !== "United States") {
      tables = [tables[0]];
    }
    for (const tableElem of tables) {
      const table = $(tableElem);
      table.find("tr").each((_rowIndex, rowElem) => {
        const tds = $(rowElem).find("td").toArray();
        // console.log(country, tds.length);
        const dateStr = $(tds[0]).text().trim();
        // TODO: Extract wikipedia link from tds[1] to find image if missing from image column
        const event = $(tds[1]).text().trim();
        const origin = $(tds[2]).text().trim();
        const imageUrl = $(tds[4]).find("img")?.attr("src")?.trim();
        let date = parse(dateStr, "MMMM d", new Date(0));
        if (isNaN(date.getTime())) {
          date = new Date(0);
        }
        let details = "";
        if (origin) {
          details = `Origin: ${origin}`;
        }
        if (event) {
          // console.log(dateStr, date);
          events.push({
            date,
            event,
            details,
            imageUrl,
            country,
          });
        }
      });
    }
  });

  return orderBy(events, (x) => x.date);
}

export const parsers: Record<SourceType, ParseFunction> = {
  wikipedia: parseWikipedia,
};
