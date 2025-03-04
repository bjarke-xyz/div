import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { datesApi } from "./api/dates";
import { foodDaysApi } from "./api/food-days";
import { vaApi } from "./api/va";
import { sites } from "./sites";

const app = new Hono();
app.use(logger());

app.route("/api/dates", datesApi);
app.route("/api/food-days", foodDaysApi);
app.route("/api/va", vaApi);

app.get(
  "/assets/*",
  serveStatic({
    root: "./dist",
  })
);

app.get(
  "/va/img/*",
  serveStatic({
    root: "./dist",
  })
);

for (const site of sites) {
  app.get(`${site}*`, serveStatic({ path: `./dist${site}index.html` }));
}
app.get("/date.txt", serveStatic({ path: "./dist/date.txt" }));
app.get("/sp_favicon.ico", serveStatic({ path: "./dist/sp_favicon.ico" }));
app.get("/vite.svg", serveStatic({ path: "./dist/vite.svg" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

export default app;
