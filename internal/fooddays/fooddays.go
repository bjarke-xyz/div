// Package fooddays scrapes Wikipedia's list of food days.
//
// The scrape is cached rather than stored: the previous implementation kept the
// parsed list in R2 with no expiry and refreshed it only when the store came
// back empty, so a page edit could take arbitrarily long to show up. Here the
// list is just another cache entry with a TTL, and the source of truth stays
// where it always was — Wikipedia.
package fooddays

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/bjarke-xyz/div/internal/cache"
)

const (
	sourceURL = "https://en.wikipedia.org/wiki/List_of_food_days"
	cacheKey  = "food-days:wikipedia"
	ttl       = 7 * 24 * time.Hour
)

// DayEvent is a food day. Date carries a real year of 1970 — only the month and
// day are meaningful, and the frontend re-years it to the current year
// (frontend/food-days/App.tsx:29).
//
// Details is always emitted, empty or not, as it was before; ImageUrl is
// omitted when absent, because it used to be undefined and drop out of the
// JSON entirely.
type DayEvent struct {
	Date     time.Time `json:"date"`
	Event    string    `json:"event"`
	Details  string    `json:"details"`
	ImageUrl string    `json:"imageUrl,omitempty"`
	Country  string    `json:"country"`
}

type Service struct {
	cache  *cache.Cache
	client *http.Client
}

func NewService(c *cache.Cache) *Service {
	return &Service{cache: c, client: &http.Client{Timeout: 20 * time.Second}}
}

// Events returns every food day, oldest month first. A scrape failure returns
// the error rather than an empty list, so the handler can say so instead of
// implying Wikipedia listed nothing.
func (s *Service) Events(ctx context.Context) ([]DayEvent, error) {
	var events []DayEvent
	found, err := s.cache.GetObj(ctx, cacheKey, &events)
	if err != nil {
		slog.Error("cache read failed", "key", cacheKey, "error", err)
	}
	if found && len(events) > 0 {
		return events, nil
	}

	html, err := s.fetch(ctx)
	if err != nil {
		return nil, err
	}
	events, err = parseWikipedia(html)
	if err != nil {
		return nil, err
	}
	// An empty parse is not cached: it almost certainly means Wikipedia changed
	// its markup, and caching it would hide the breakage for a week.
	if len(events) == 0 {
		return nil, fmt.Errorf("fooddays: parsed no events from %s", sourceURL)
	}

	if err := s.cache.SetObj(ctx, cacheKey, events, ttl); err != nil {
		slog.Error("cache write failed", "key", cacheKey, "error", err)
	}
	return events, nil
}

func (s *Service) fetch(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}
	// Wikimedia's user-agent policy rejects Go's default agent with a 403, so
	// the client has to name itself.
	req.Header.Set("User-Agent", "div/1.0 (https://github.com/bjarke-xyz/div)")
	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fooddays: unexpected status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// parseWikipedia walks each country heading and reads that country's tables.
//
// The markup has moved twice, so two shapes are handled. Wikipedia used to emit
// a flat document — <h2><span class="mw-headline">Country</span></h2> followed
// by sibling tables — and now serves Parsoid HTML, where each country is a
// <section> wrapping a <div class="mw-heading"><h2>, and .mw-headline is gone
// entirely. Preferring the enclosing <section> is what makes the United States
// work: its tables live in nested subsections, so no amount of sibling-scanning
// from the heading reaches them, and it is the country with by far the most
// days.
//
// Headings with no table under them (Contents, See also, References) drop out
// on their own, since they turn up no rows.
func parseWikipedia(html string) ([]DayEvent, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("fooddays: parsing html: %w", err)
	}

	events := []DayEvent{}
	doc.Find("h2").Each(func(_ int, h2 *goquery.Selection) {
		country := strings.TrimSpace(h2.Text())
		if headline := h2.Find(".mw-headline"); headline.Length() > 0 {
			country = strings.TrimSpace(headline.Text())
		}
		if country == "" {
			return
		}
		// Matched case-insensitively because the page now writes "Global or
		// international"; an exact compare stopped normalising this heading.
		if strings.EqualFold(country, "Global or International") {
			country = "International"
		}

		tables := tablesFor(h2)
		// Only the United States splits its days across several tables — one per
		// month. Every other country stops at the first, and taking more would
		// pull in the following country's days.
		if country != "United States" {
			tables = tables.First()
		}

		tables.Each(func(_ int, table *goquery.Selection) {
			table.Find("tr").Each(func(_ int, row *goquery.Selection) {
				if event := parseRow(row, country); event != nil {
					events = append(events, *event)
				}
			})
		})
	})

	sort.SliceStable(events, func(i, j int) bool { return events[i].Date.Before(events[j].Date) })
	return events, nil
}

// tablesFor returns the data tables belonging to a heading, preferring the
// enclosing Parsoid <section> and falling back to a sibling scan for the older
// flat markup.
func tablesFor(h2 *goquery.Selection) *goquery.Selection {
	if section := h2.Closest("section"); section.Length() > 0 {
		if tables := section.Find("table.wikitable"); tables.Length() > 0 {
			return tables
		}
	}
	if tables := h2.NextAllFiltered("table.wikitable"); tables.Length() > 0 {
		return tables
	}
	return h2.Parent().NextAllFiltered("table.wikitable")
}

func parseRow(row *goquery.Selection, country string) *DayEvent {
	tds := row.Find("td")
	// Header rows have no <td> at all, and a malformed row is skipped rather
	// than indexed into.
	if tds.Length() < 2 {
		return nil
	}
	cell := func(i int) string { return strings.TrimSpace(tds.Eq(i).Text()) }

	event := cell(1)
	if event == "" {
		return nil
	}

	// An unparseable date becomes the epoch, keeping the row rather than
	// dropping it — the event name is the useful part, and the frontend groups
	// by month.
	date := time.Unix(0, 0).UTC()
	if parsed, err := time.Parse("January 2 2006", cell(0)+" 1970"); err == nil {
		date = parsed
	}

	details := ""
	if origin := cell(2); origin != "" {
		details = "Origin: " + origin
	}
	imageUrl := ""
	if tds.Length() > 4 {
		if src, ok := tds.Eq(4).Find("img").First().Attr("src"); ok {
			imageUrl = strings.TrimSpace(src)
		}
	}

	return &DayEvent{
		Date:     date,
		Event:    event,
		Details:  details,
		ImageUrl: imageUrl,
		Country:  country,
	}
}

// Today filters to events falling on the given month and day, ignoring the
// year, which is always 1970.
func Today(events []DayEvent, now time.Time) []DayEvent {
	filtered := []DayEvent{}
	for _, e := range events {
		if e.Date.Month() == now.Month() && e.Date.Day() == now.Day() {
			filtered = append(filtered, e)
		}
	}
	return filtered
}
