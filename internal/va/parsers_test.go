package va

import (
	"testing"
	"time"
)

func TestJSRound(t *testing.T) {
	// Go's math.Round would answer -1 for -0.5 and -2 for -1.5. The frontend has
	// always shown JavaScript's answer, so the halves matter.
	tests := []struct {
		in   float64
		want float64
	}{
		{0.5, 1}, {1.5, 2}, {2.4, 2}, {-0.5, 0}, {-1.5, -1}, {-2.6, -3},
	}
	for _, tt := range tests {
		if got := jsRound(tt.in); got != tt.want {
			t.Errorf("jsRound(%v) = %v, want %v", tt.in, got, tt.want)
		}
	}
}

func TestJSNum(t *testing.T) {
	// Precipitation is rendered into a display string, so trailing zeros show up
	// on the page.
	tests := []struct {
		in   float64
		want string
	}{
		{0, "0"}, {0.1, "0.1"}, {1.25, "1.25"}, {12, "12"},
	}
	for _, tt := range tests {
		if got := jsNum(tt.in); got != tt.want {
			t.Errorf("jsNum(%v) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestParseDMI(t *testing.T) {
	// DMI reports Copenhagen wall-clock with no offset. 12:00 local in July is
	// 10:00Z; getting this wrong shifts the whole forecast by two hours.
	const raw = `{"city":"Odense","timeserie":[
		{"time":"20260716120000","temp":21.6,"symbol":3,"precipType":"rain"},
		{"time":"","temp":9,"symbol":1},
		{"time":"20260716130000","temp":-0.5,"symbol":2}
	]}`

	forecast, err := parseDMI(raw)
	if err != nil {
		t.Fatalf("parseDMI: %v", err)
	}
	// The entry with an empty time is skipped, not defaulted.
	if len(forecast) != 2 {
		t.Fatalf("got %d entries, want 2", len(forecast))
	}

	first := forecast[0]
	if want := time.Date(2026, 7, 16, 10, 0, 0, 0, time.UTC); !first.Timestamp.Equal(want) {
		t.Errorf("timestamp = %v, want %v", first.Timestamp, want)
	}
	if first.Source != "DMI" {
		t.Errorf("source = %q, want DMI", first.Source)
	}
	// The bare symbol id, which the frontend turns into an icon URL.
	if first.Description != "3" {
		t.Errorf("description = %q, want \"3\"", first.Description)
	}
	if first.Temperature != 22 {
		t.Errorf("temperature = %v, want 22", first.Temperature)
	}
	if first.Precipitation != "N/A" {
		t.Errorf("precipitation = %q, want N/A", first.Precipitation)
	}
	if forecast[1].Temperature != 0 {
		t.Errorf("temperature = %v, want 0 (JS rounds -0.5 up)", forecast[1].Temperature)
	}
}

func TestParseYR(t *testing.T) {
	// Three shapes in one payload: an hourly bucket, a fallback to next_6_hours
	// at the far end of the forecast, and a bucket with no precipitation figure.
	const raw = `{"properties":{
		"meta":{"units":{"precipitation_amount":"mm"}},
		"timeseries":[
			{"time":"2026-07-16T12:00:00Z","data":{"instant":{"details":{"air_temperature":21.4}},
				"next_1_hours":{"summary":{"symbol_code":"partlycloudy_day"},"details":{"precipitation_amount":0.1}}}},
			{"time":"2026-07-16T13:00:00Z","data":{"instant":{"details":{"air_temperature":19.6}},
				"next_6_hours":{"summary":{"symbol_code":"rain"},"details":{"precipitation_amount":0}}}},
			{"time":"2026-07-16T14:00:00Z","data":{"instant":{"details":{"air_temperature":18}},
				"next_1_hours":{"summary":{"symbol_code":"fair_day"},"details":{}}}}
		]}}`

	forecast, err := parseYR(raw)
	if err != nil {
		t.Fatalf("parseYR: %v", err)
	}
	if len(forecast) != 3 {
		t.Fatalf("got %d entries, want 3", len(forecast))
	}

	// symbol_code must survive verbatim: it names a PNG in the frontend.
	if forecast[0].Description != "partlycloudy_day" {
		t.Errorf("description = %q", forecast[0].Description)
	}
	if forecast[0].Precipitation != "0.1 mm" {
		t.Errorf("precipitation = %q, want \"0.1 mm\"", forecast[0].Precipitation)
	}
	// Falls back to the 6-hour bucket, and a real zero is "0 mm", not "N/A".
	if forecast[1].Description != "rain" || forecast[1].Precipitation != "0 mm" {
		t.Errorf("6h fallback = %q / %q", forecast[1].Description, forecast[1].Precipitation)
	}
	// An absent amount is "N/A" — distinct from a reported zero.
	if forecast[2].Precipitation != "N/A" {
		t.Errorf("precipitation = %q, want N/A", forecast[2].Precipitation)
	}
	if forecast[1].Temperature != 20 {
		t.Errorf("temperature = %v, want 20", forecast[1].Temperature)
	}
}

func TestParseOWM(t *testing.T) {
	// The free plan is 3-hourly, so each point is repeated at +1h and +2h to
	// give the chart an hourly series.
	const raw = `{"list":[
		{"dt":1784206800,"main":{"temp":21.2},"weather":[{"description":"light rain"}],"rain":{"3h":0.42}},
		{"dt":1784217600,"main":{"temp":18.8},"weather":[{"description":"clear sky"}]}
	],"city":{"sunrise":1784173096,"sunset":1784233817}}`

	forecast, err := parseOWM(raw)
	if err != nil {
		t.Fatalf("parseOWM: %v", err)
	}
	if len(forecast) != 6 {
		t.Fatalf("got %d entries, want 6 (2 points x 3)", len(forecast))
	}

	// The fillers are copies of the point, an hour apart.
	for i, want := range []time.Duration{0, time.Hour, 2 * time.Hour} {
		got := forecast[i].Timestamp.Sub(forecast[0].Timestamp)
		if got != want {
			t.Errorf("entry %d offset = %v, want %v", i, got, want)
		}
		if forecast[i].Description != "light rain" || forecast[i].Precipitation != "0.42 mm" {
			t.Errorf("entry %d = %q / %q", i, forecast[i].Description, forecast[i].Precipitation)
		}
	}
	// No rain key at all still reads "0 mm", as the old falsy check did.
	if forecast[3].Precipitation != "0 mm" {
		t.Errorf("precipitation = %q, want \"0 mm\"", forecast[3].Precipitation)
	}
}

func TestParseSunData(t *testing.T) {
	const raw = `{"list":[],"city":{"sunrise":1784173096,"sunset":1784233817}}`

	sun, err := parseSunData(raw)
	if err != nil {
		t.Fatalf("parseSunData: %v", err)
	}
	if len(sun.Dates) != 5 {
		t.Fatalf("got %d dates, want 5", len(sun.Dates))
	}
	// Later days are day-shifted copies, not real astronomy.
	for i, d := range sun.Dates {
		if want := sun.Dates[0].Sunrise.AddDate(0, 0, i); !d.Sunrise.Equal(want) {
			t.Errorf("day %d sunrise = %v, want %v", i, d.Sunrise, want)
		}
	}
}

func TestParseSunDataNoCity(t *testing.T) {
	// OWM answers without a city block when it does not know the location; the
	// endpoint reports null rather than inventing times.
	sun, err := parseSunData(`{"list":[]}`)
	if err != nil {
		t.Fatalf("parseSunData: %v", err)
	}
	if sun != nil {
		t.Errorf("got %+v, want nil", sun)
	}
}

func TestParseTV2(t *testing.T) {
	// Locks the shape the scraper was written against. The live site no longer
	// serves this markup — see the note on parseTV2 — so this proves the parser
	// itself is faithful, not that TV2 still works.
	const html = `<html><body>
		<table class="location-table">
			<caption><div><time datetime="2026-07-16T00:00:00Z">16 July</time></div></caption>
			<tbody>
				<tr>
					<td class="time"><time datetime="2026-07-16 12:00">12:00</time></td>
					<td class="icon"><img alt="Let regn"/></td>
					<td class="degrees">21.5</td>
					<td class="precipitation">0,4 mm</td>
				</tr>
			</tbody>
		</table></body></html>`

	forecast, err := parseTV2(html)
	if err != nil {
		t.Fatalf("parseTV2: %v", err)
	}
	if len(forecast) != 1 {
		t.Fatalf("got %d entries, want 1", len(forecast))
	}
	if want := time.Date(2026, 7, 16, 10, 0, 0, 0, time.UTC); !forecast[0].Timestamp.Equal(want) {
		t.Errorf("timestamp = %v, want %v", forecast[0].Timestamp, want)
	}
	// TV2 is the one source that is not rounded.
	if forecast[0].Temperature != 21.5 {
		t.Errorf("temperature = %v, want 21.5", forecast[0].Temperature)
	}
	if forecast[0].Description != "Let regn" {
		t.Errorf("description = %q", forecast[0].Description)
	}
}

func TestParseTV2NewMarkup(t *testing.T) {
	// What the live site actually serves as of July 2026: no .location-table.
	// An empty forecast, not an error — the API renders it as an empty array.
	const html = `<html><body><table class="tc_weather__forecast__list">
		<tbody><tr class="tc_weather__forecast__list__row">
			<td class="tc_weather__forecast__list__temperature">21</td>
		</tr></tbody></table></body></html>`

	forecast, err := parseTV2(html)
	if err != nil {
		t.Fatalf("parseTV2: %v", err)
	}
	if len(forecast) != 0 {
		t.Errorf("got %d entries, want 0", len(forecast))
	}
}

func TestLookup(t *testing.T) {
	// An absent city defaults; an unknown one does not, because the caller has
	// to be able to answer null for it rather than quietly serving Odense.
	if city, ok := lookup(""); !ok || city.Name != DefaultCity {
		t.Errorf("lookup(\"\") = %v, %v; want %s, true", city.Name, ok, DefaultCity)
	}
	if city, ok := lookup("kØbenhavn"); !ok || city.Name != "København" {
		t.Errorf("lookup is not case-insensitive: %v, %v", city.Name, ok)
	}
	if _, ok := lookup("Berlin"); ok {
		t.Error("lookup(\"Berlin\") = true, want false")
	}
}

func TestCityNamesOrder(t *testing.T) {
	// The frontend defaults to cities[0], so this order is part of the API.
	want := []string{"Odense", "Aarhus", "København", "Esbjerg", "Aalborg", "Svendborg"}
	got := CityNames()
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("index %d = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestCacheKeyStripsAPIKey(t *testing.T) {
	// The OWM key must not reach the cache table: it would sit there in
	// plaintext, and rotating it would orphan every cached entry.
	got := cacheKey("JSON", "https://api.openweathermap.org/data/2.5/forecast?lat=1&lon=2&appid=SECRET")
	want := "JSON:https://api.openweathermap.org/data/2.5/forecast?lat=1&lon=2"
	if got != want {
		t.Errorf("cacheKey = %q, want %q", got, want)
	}
}
