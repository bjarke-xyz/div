# div

A handful of small pages — dates, timetracker, va (weather), food-days,
hash-data, map — served by one Go binary with the built frontend embedded in it.

## Layout

    main.go              wiring: config, SQLite, embedded dist, HTTP server
    schema.sql           the cache table, replayed on every boot
    internal/cache       TTL key/value store over SQLite
    internal/va          weather: city URLs, per-site parsers, fetch-through-cache
    internal/fooddays    Wikipedia food-day scraper
    internal/server      routes, handlers, SPA static handler
    frontend/            React pages, built by vite into dist/

## The database is a cache

SQLite holds nothing but scraped payloads with expiries. Every row can be
re-fetched from the site it came from, so the file is disposable: deleting it
costs one round of re-scraping and nothing else. It is deliberately **not**
backed up, and must not be added to `sqlite-backer-upper`.

| Key | TTL | Contents |
|---|---|---|
| `HTML:<url>` / `JSON:<url>` | 1h | raw payload from TV2, DMI, met.no, OWM |
| `SVG:<id>` | 30d | DMI weather symbol |
| `food-days:wikipedia` | 7d | parsed food days |

## Running it

`dist/` is embedded via `go:embed`, so the frontend has to be built before the
binary will compile:

    make build      # npm ci && npm run build && go build
    make dev        # go run, loading .env
    make test       # go test ./...

For frontend work, `npm run dev` runs vite with HMR and `npm run dev-api` runs
the Go API alongside it.

### Environment

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `DB_PATH` | `./div.db` | `/data/div.db` in the container |
| `OWM_API_KEY` | — | without it the `owm` source and `/api/va/sun` are empty |
| `JOB_KEY` | — | required by `POST /api/va/cache-refresh`; unset rejects every request |

## API

- `POST /api/dates/naturaldate/parse` — `{naturalDate}` → `{input, output}`, where
  `output` is an ISO timestamp or `null` if the phrase did not parse.
- `GET /api/food-days/events[?today=true]` — food days. Dates carry the year 1970;
  only month and day mean anything.
- `GET /api/va/cities` — city names, in display order.
- `GET /api/va/weather?city=` — `{tv2, dmi, yr, owm}`, each a forecast array or
  `null` if that source failed.
- `GET /api/va/sun?city=` — sunrise/sunset for five days.
- `GET /api/va/proxy/dmi/symbol/{id}/icon.svg` — cached DMI symbol.
- `POST /api/va/cache-refresh` — warms every city × source. Needs `JOB_KEY`.

## Scrapers

DMI, met.no and OWM are JSON APIs. Two sources are HTML scrapes and will break
when the sites are restyled — the parser tests are the early warning:

- **Wikipedia** (food days) is served as Parsoid HTML, where each country is a
  `<section>` and the US keeps its tables in nested subsections.
- **TV2 is currently broken.** As of July 2026 the page no longer has the
  `.location-table` markup `parseTV2` looks for, so the `tv2` source returns an
  empty list. It was already doing this before the Go rewrite; fixing it against
  the new `tc_weather__forecast__list__*` markup is its own job.
