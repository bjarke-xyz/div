package va

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// copenhagen is where every site's wall-clock timestamp is anchored. TV2 and
// DMI report local time with no offset, so the zone is the only thing that
// makes their timestamps unambiguous. tzdata is embedded in main, so this
// resolves inside a distroless image.
var copenhagen = mustLoadLocation("Europe/Copenhagen")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(fmt.Sprintf("va: loading %s: %v", name, err))
	}
	return loc
}

// jsRound reproduces JavaScript's Math.round, which rounds halves towards
// positive infinity. Go's math.Round rounds halves away from zero, so the two
// disagree on exactly -0.5, -1.5, … — temperatures that do occur here.
func jsRound(f float64) float64 {
	return math.Floor(f + 0.5)
}

// jsNum formats a float the way JavaScript's Number#toString does: shortest
// representation, no trailing zeros. Precipitation values are rendered into a
// display string, so "0.1 mm" must not become "0.100000 mm".
func jsNum(f float64) string {
	return strconv.FormatFloat(f, 'f', -1, 64)
}

// parseTV2 scrapes vejr.tv2.dk.
//
// These selectors no longer match: as of July 2026 the page is still
// server-rendered, but the forecast table now uses tc_weather__forecast__list__*
// class names, with no .location-table or .degrees anywhere. So this returns an
// empty forecast, which is what the TV2 source was already doing before the Go
// rewrite — the port is faithful, the site moved. Rewriting it against the new
// markup is deliberately left for its own change.
func parseTV2(html string) ([]WeatherForecast, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("tv2: parsing html: %w", err)
	}

	forecast := []WeatherForecast{}
	var parseErr error
	doc.Find(".location-table").EachWithBreak(func(_ int, table *goquery.Selection) bool {
		// A table whose caption has no parseable date is skipped rather than
		// failing the source: TV2 puts non-forecast tables on the same page.
		dateStr, _ := table.Find("caption > div > time").First().Attr("datetime")
		if _, err := time.Parse(time.RFC3339, dateStr); err != nil {
			return true
		}

		table.Find("tbody > tr").EachWithBreak(func(_ int, row *goquery.Selection) bool {
			timestampStr, _ := row.Find(".time > time").First().Attr("datetime")
			timestamp, err := time.ParseInLocation("2006-01-02 15:04", timestampStr, copenhagen)
			if err != nil {
				parseErr = fmt.Errorf("invalid timestamp (tv2): %q", timestampStr)
				return false
			}

			description, _ := row.Find(".icon > img").First().Attr("alt")
			// A blank or non-numeric cell parses as 0, matching Number("") in
			// the previous implementation. Not rounded: TV2 is the one source
			// whose temperature was passed through as written.
			temperature, _ := strconv.ParseFloat(strings.TrimSpace(row.Find(".degrees").Text()), 64)

			forecast = append(forecast, WeatherForecast{
				Source:        string(SiteTV2),
				Timestamp:     timestamp.UTC(),
				Description:   description,
				Temperature:   temperature,
				Precipitation: row.Find(".precipitation").Text(),
			})
			return true
		})
		return parseErr == nil
	})

	return forecast, parseErr
}

type dmiTimeSerie struct {
	Time   string  `json:"time"`
	Temp   float64 `json:"temp"`
	Symbol int     `json:"symbol"`
}

type dmiJSON struct {
	Timeserie []dmiTimeSerie `json:"timeserie"`
}

func parseDMI(raw string) ([]WeatherForecast, error) {
	var data dmiJSON
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		return nil, fmt.Errorf("dmi: %w", err)
	}

	forecast := []WeatherForecast{}
	for _, point := range data.Timeserie {
		if point.Time == "" {
			continue
		}
		timestamp, err := time.ParseInLocation("20060102150405", point.Time, copenhagen)
		if err != nil {
			return nil, fmt.Errorf("invalid date (dmi): %q", point.Time)
		}
		forecast = append(forecast, WeatherForecast{
			Source:    string(SiteDMI),
			Timestamp: timestamp.UTC(),
			// The bare symbol id: the frontend turns it into
			// /api/va/proxy/dmi/symbol/<id>/icon.svg.
			Description:   strconv.Itoa(point.Symbol),
			Temperature:   jsRound(point.Temp),
			Precipitation: "N/A",
		})
	}
	return forecast, nil
}

type yrNextXHours struct {
	Summary struct {
		SymbolCode string `json:"symbol_code"`
	} `json:"summary"`
	Details struct {
		// A pointer: an absent amount renders "N/A" while a present 0 renders
		// "0 mm", and the zero value cannot tell those apart.
		PrecipitationAmount *float64 `json:"precipitation_amount"`
	} `json:"details"`
}

type yrJSON struct {
	Properties struct {
		Meta struct {
			Units struct {
				PrecipitationAmount string `json:"precipitation_amount"`
			} `json:"units"`
		} `json:"meta"`
		Timeseries []struct {
			Time string `json:"time"`
			Data struct {
				Instant struct {
					Details struct {
						AirTemperature float64 `json:"air_temperature"`
					} `json:"details"`
				} `json:"instant"`
				Next1Hours  *yrNextXHours `json:"next_1_hours"`
				Next6Hours  *yrNextXHours `json:"next_6_hours"`
				Next12Hours *yrNextXHours `json:"next_12_hours"`
			} `json:"data"`
		} `json:"timeseries"`
	} `json:"properties"`
}

func parseYR(raw string) ([]WeatherForecast, error) {
	var data yrJSON
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		return nil, fmt.Errorf("yr: %w", err)
	}

	forecast := []WeatherForecast{}
	for _, ts := range data.Properties.Timeseries {
		timestamp, err := time.Parse(time.RFC3339, ts.Time)
		if err != nil {
			return nil, fmt.Errorf("invalid timestamp (yr): %q", ts.Time)
		}

		// Coarser buckets are the fallback: the far end of the forecast only
		// carries 6- or 12-hour summaries.
		next := ts.Data.Next1Hours
		if next == nil {
			next = ts.Data.Next6Hours
		}
		if next == nil {
			next = ts.Data.Next12Hours
		}

		description := ""
		precipitation := "N/A"
		if next != nil {
			description = next.Summary.SymbolCode
			if amount := next.Details.PrecipitationAmount; amount != nil {
				precipitation = jsNum(*amount) + " " + data.Properties.Meta.Units.PrecipitationAmount
			}
		}

		forecast = append(forecast, WeatherForecast{
			Source:    string(SiteYR),
			Timestamp: timestamp.UTC(),
			// symbol_code, which maps to the PNGs in frontend/public/va/img/yr/.
			Description:   description,
			Temperature:   jsRound(ts.Data.Instant.Details.AirTemperature),
			Precipitation: precipitation,
		})
	}
	return forecast, nil
}

type owmJSON struct {
	List []struct {
		Dt   int64 `json:"dt"`
		Main struct {
			Temp float64 `json:"temp"`
		} `json:"main"`
		Weather []struct {
			Description string `json:"description"`
		} `json:"weather"`
		Rain struct {
			ThreeH float64 `json:"3h"`
		} `json:"rain"`
	} `json:"list"`
	City *struct {
		Sunrise int64 `json:"sunrise"`
		Sunset  int64 `json:"sunset"`
	} `json:"city"`
}

func parseOWM(raw string) ([]WeatherForecast, error) {
	var data owmJSON
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		return nil, fmt.Errorf("owm: %w", err)
	}

	forecast := []WeatherForecast{}
	for _, point := range data.List {
		timestamp := time.Unix(point.Dt, 0).UTC()

		description := ""
		if len(point.Weather) > 0 {
			description = point.Weather[0].Description
		}
		// A zero amount reads as "0 mm", which is also what the old ternary
		// produced, since 0 is falsy.
		precipitation := "0 mm"
		if point.Rain.ThreeH != 0 {
			precipitation = jsNum(point.Rain.ThreeH) + " mm"
		}

		entry := WeatherForecast{
			Source:        string(SiteOWM),
			Timestamp:     timestamp,
			Description:   description,
			Temperature:   jsRound(point.Main.Temp),
			Precipitation: precipitation,
		}
		forecast = append(forecast, entry)

		// The free OWM plan only returns 3-hourly points, so each one is
		// repeated at +1h and +2h to give the chart an hourly series to match
		// the other three sources. The extra points are copies, not estimates.
		for _, offset := range []time.Duration{1 * time.Hour, 2 * time.Hour} {
			filler := entry
			filler.Timestamp = timestamp.Add(offset)
			forecast = append(forecast, filler)
		}
	}
	return forecast, nil
}

// parseSunData reads sunrise/sunset out of the same OWM forecast payload.
//
// It reports one entry per day for five days, but OWM only gives a single
// sunrise/sunset pair, so later days are that pair shifted by whole days rather
// than real astronomy. Carried over as-is: the page only shows rough times.
func parseSunData(raw string) (*SunData, error) {
	var data owmJSON
	if err := json.Unmarshal([]byte(raw), &data); err != nil {
		return nil, fmt.Errorf("owm sun: %w", err)
	}
	if data.City == nil {
		return nil, nil
	}

	now := time.Now()
	sunrise := time.Unix(data.City.Sunrise, 0)
	sunset := time.Unix(data.City.Sunset, 0)

	sun := &SunData{Dates: make([]SunDate, 0, 5)}
	for offset := range 5 {
		sun.Dates = append(sun.Dates, SunDate{
			Date:    now.AddDate(0, 0, offset),
			Sunset:  sunset.AddDate(0, 0, offset),
			Sunrise: sunrise.AddDate(0, 0, offset),
		})
	}
	return sun, nil
}
