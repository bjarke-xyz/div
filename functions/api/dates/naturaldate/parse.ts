import { parseDate } from "chrono-node";

interface NaturalDateParseRequest {
  naturalDate?: string;
}
export const onRequest: PagesFunction = async (context) => {
  const body = (await context.request.json()) as NaturalDateParseRequest;
  if (!body?.naturalDate) {
    return new Response("", { status: 400 });
  }
  const parsedDate = parseDate(body.naturalDate);
  const responseObj = {
    input: body.naturalDate,
    output: parsedDate?.toISOString() ?? null,
  };
  return new Response(JSON.stringify(responseObj), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
