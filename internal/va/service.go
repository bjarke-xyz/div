package va

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/bjarke-xyz/div/internal/cache"
)

const (
	// sourceTTL is how long a scraped payload stays fresh. The forecasts
	// themselves only move a few times a day; this is mostly about not hammering
	// four sites once per page view.
	sourceTTL = time.Hour
	// iconTTL is long because a DMI weather symbol never changes.
	iconTTL = 30 * 24 * time.Hour
)

type Service struct {
	cache     *cache.Cache
	client    *http.Client
	owmAPIKey string
}

func NewService(c *cache.Cache, owmAPIKey string) *Service {
	return &Service{
		cache:  c,
		client: &http.Client{Timeout: 20 * time.Second},
		// Absent, OWM answers 401 and both owm and sun go null. The other three
		// sources need no key and keep working.
		owmAPIKey: owmAPIKey,
	}
}

// url returns the request URL for a site, with the OWM key appended.
func (s *Service) url(city City, site Site) string {
	u := city.URLs[site]
	if site == SiteOWM {
		u += "&appid=" + s.owmAPIKey
	}
	return u
}

// cacheKey is the URL prefixed by payload kind. The OWM key is stripped rather
// than keyed on: it would otherwise be written into the cache table in
// plaintext, and rotating it would silently orphan every cached entry.
func cacheKey(kind, url string) string {
	if i := strings.Index(url, "&appid="); i != -1 {
		url = url[:i]
	}
	return kind + ":" + url
}

// fetch returns the body for url, from cache when fresh. A failure is logged
// and returned as an empty string: one unreachable site must not fail the
// other three, and the caller renders it as a null source.
func (s *Service) fetch(ctx context.Context, kind, url string, headers map[string]string) string {
	if url == "" {
		return ""
	}
	key := cacheKey(kind, url)

	cached, err := s.cache.Get(ctx, key)
	if err != nil {
		slog.Error("cache read failed", "key", key, "error", err)
	}
	if cached != "" {
		return cached
	}

	body, err := s.get(ctx, url, headers)
	if err != nil {
		slog.Error("fetch failed", "url", url, "error", err)
		return ""
	}
	if err := s.cache.Set(ctx, key, body, sourceTTL); err != nil {
		slog.Error("cache write failed", "key", key, "error", err)
	}
	return body
}

func (s *Service) get(ctx context.Context, url string, headers map[string]string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// metNoHeaders identifies the client to met.no, which rejects requests that do
// not name one.
var metNoHeaders = map[string]string{"User-Agent": "va github.com/bjarke-xyz/va"}

// forecast fetches and parses one site. A nil slice means the source failed or
// is unknown, which the API renders as null.
func (s *Service) forecast(ctx context.Context, city City, site Site) []WeatherForecast {
	var (
		body     string
		forecast []WeatherForecast
		err      error
	)

	switch site {
	case SiteTV2:
		body = s.fetch(ctx, "HTML", s.url(city, site), nil)
		if body != "" {
			forecast, err = parseTV2(body)
		}
	case SiteDMI:
		body = s.fetch(ctx, "JSON", s.url(city, site), nil)
		if body != "" {
			forecast, err = parseDMI(body)
		}
	case SiteYR:
		body = s.fetch(ctx, "JSON", s.url(city, site), metNoHeaders)
		if body != "" {
			forecast, err = parseYR(body)
		}
	case SiteOWM:
		body = s.fetch(ctx, "JSON", s.url(city, site), nil)
		if body != "" {
			forecast, err = parseOWM(body)
		}
	}

	if err != nil {
		// A parse failure means the site changed its markup. Report the source
		// as null rather than failing the request: the other three are still
		// good, and this is how the frontend already renders an absent source.
		slog.Error("parse failed", "site", site, "city", city.Name, "error", err)
		return nil
	}
	return forecast
}

// Weather returns a forecast per site, keyed by the lowercased site name. An
// unknown city yields a null for every source, which is what the previous
// implementation did by way of an undefined URL.
func (s *Service) Weather(ctx context.Context, cityName string) map[string][]WeatherForecast {
	result := make(map[string][]WeatherForecast, len(Sites))
	city, ok := lookup(cityName)
	if !ok {
		for _, site := range Sites {
			result[strings.ToLower(string(site))] = nil
		}
		return result
	}

	// The four sites are fetched concurrently; a page view otherwise waits on
	// them in series, and the slowest is the one that sets the latency.
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, site := range Sites {
		wg.Go(func() {
			forecast := s.forecast(ctx, city, site)
			mu.Lock()
			defer mu.Unlock()
			result[strings.ToLower(string(site))] = forecast
		})
	}
	wg.Wait()
	return result
}

// Sun returns sunrise/sunset for the next five days, or nil when OWM has
// nothing to say about the city.
func (s *Service) Sun(ctx context.Context, cityName string) *SunData {
	city, ok := lookup(cityName)
	if !ok {
		return nil
	}
	body := s.fetch(ctx, "JSON", s.url(city, SiteOWM), nil)
	if body == "" {
		return nil
	}

	sun, err := parseSunData(body)
	if err != nil {
		slog.Error("parse failed", "site", SiteOWM, "city", city.Name, "error", err)
		return nil
	}
	return sun
}

// Icon returns a DMI weather symbol, cached for iconTTL. The symbols are
// immutable, so this is a permanent saving after the first request.
func (s *Service) Icon(ctx context.Context, id string) (string, error) {
	key := "SVG:" + id
	if cached, err := s.cache.Get(ctx, key); err != nil {
		slog.Error("cache read failed", "key", key, "error", err)
	} else if cached != "" {
		return cached, nil
	}

	svg, err := s.get(ctx, "https://www.dmi.dk/assets/img/"+id+".svg", nil)
	if err != nil {
		return "", err
	}
	if err := s.cache.Set(ctx, key, svg, iconTTL); err != nil {
		slog.Error("cache write failed", "key", key, "error", err)
	}
	return svg, nil
}

// Refresh warms every city × site combination, so the next visitor reads from
// SQLite instead of waiting on four sites.
func (s *Service) Refresh(ctx context.Context) {
	var wg sync.WaitGroup
	for _, city := range cities {
		for _, site := range Sites {
			wg.Go(func() { s.forecast(ctx, city, site) })
		}
	}
	wg.Wait()

	if err := s.cache.DeleteExpired(ctx); err != nil {
		slog.Error("cache sweep failed", "error", err)
	}
}
