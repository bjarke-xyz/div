import { parseDate } from "chrono-node";
import { Hono } from "hono";

export const datesApi = new Hono();

interface NaturalDateParseRequest {
  naturalDate?: string;
}

datesApi.post("/naturaldate/parse", async (c) => {
  const body = await c.req.json<NaturalDateParseRequest>();
  if (!body?.naturalDate) {
    return c.status(400);
  }
  const parsedDate = parseDate(body.naturalDate);
  const responseObj = {
    input: body.naturalDate,
    output: parsedDate?.toISOString() ?? null,
  };
  return c.json(responseObj);
});
