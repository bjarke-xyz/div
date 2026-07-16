package va

import "time"

// WeatherForecast is one point in a forecast, normalised across the four sites.
//
// Description is deliberately untyped text whose meaning depends on Source, and
// the frontend builds icon URLs out of it (frontend/va/components/WeatherPage.tsx:83):
// for DMI it is the bare numeric symbol id, for YR the met.no symbol_code, and
// for TV2/OWM a human-readable phrase. Precipitation is likewise a display
// string, including its unit, or "N/A" when the site does not report one.
// Temperature is a float64 because TV2 is the one source that is not rounded
// to a whole degree: DMI, YR and OWM all round on the way in, TV2 reports
// whatever the cell says. An integer field would quietly round 12.5 to 13.
type WeatherForecast struct {
	Source        string    `json:"source"`
	Timestamp     time.Time `json:"timestamp"`
	Description   string    `json:"description"`
	Temperature   float64   `json:"temperature"`
	Precipitation string    `json:"precipitation"`
}

type SunDate struct {
	Date    time.Time `json:"date"`
	Sunset  time.Time `json:"sunset"`
	Sunrise time.Time `json:"sunrise"`
}

type SunData struct {
	Dates []SunDate `json:"dates"`
}
