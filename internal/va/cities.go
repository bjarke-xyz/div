package va

import "strings"

// Site is one of the four upstream forecast providers.
type Site string

const (
	SiteTV2 Site = "TV2"
	SiteDMI Site = "DMI"
	SiteYR  Site = "YR"
	SiteOWM Site = "OWM"
)

// Sites is the fixed iteration order for a weather response. The JSON keys are
// these lowercased; the source field on each forecast keeps this casing.
var Sites = []Site{SiteTV2, SiteDMI, SiteYR, SiteOWM}

// City carries the display name and one URL per site.
//
// This is a slice, not a map, because /api/va/cities is order-sensitive: the
// frontend defaults to cities[0] (frontend/va/App.tsx:11), and Go map iteration
// order is random. Names are stored already display-cased rather than being
// title-cased from an uppercase key at request time.
type City struct {
	Name string
	URLs map[Site]string
}

const DefaultCity = "Odense"

var cities = []City{
	{Name: "Odense", URLs: map[Site]string{
		SiteTV2: "https://vejr.tv2.dk/vejr/odense-2615876",
		SiteDMI: "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&id=2615876",
		SiteYR:  "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=55.3959&lon=10.3883",
		SiteOWM: "https://api.openweathermap.org/data/2.5/forecast?lat=55.3959&lon=10.3883&exclude=minutely&units=metric",
	}},
	{Name: "Aarhus", URLs: map[Site]string{
		SiteTV2: "https://vejr.tv2.dk/vejr/aarhus-2624652",
		SiteDMI: "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&id=2624652",
		SiteYR:  "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=56.1567&lon=10.2108",
		SiteOWM: "https://api.openweathermap.org/data/2.5/forecast?lat=56.1567&lon=10.2108&exclude=minutely&units=metric",
	}},
	{Name: "København", URLs: map[Site]string{
		SiteTV2: "https://vejr.tv2.dk/vejr/koebenhavn-2618425",
		SiteDMI: "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&id=2618425",
		SiteYR:  "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=55.6759&lon=12.5655",
		SiteOWM: "https://api.openweathermap.org/data/2.5/forecast?lat=55.6759&lon=12.5655&exclude=minutely&units=metric",
	}},
	{Name: "Esbjerg", URLs: map[Site]string{
		SiteTV2: "https://vejr.tv2.dk/vejr/esbjerg-2622447",
		SiteDMI: "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&id=2622447",
		SiteYR:  "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=55.4667&lon=8.45",
		SiteOWM: "https://api.openweathermap.org/data/2.5/forecast?lat=55.4667&lon=8.45&exclude=minutely&units=metric",
	}},
	{Name: "Aalborg", URLs: map[Site]string{
		SiteTV2: "https://vejr.tv2.dk/vejr/aalborg-2624886",
		SiteDMI: "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&id=2624886",
		SiteYR:  "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=57.048&lon=9.9187",
		SiteOWM: "https://api.openweathermap.org/data/2.5/forecast?lat=57.048&lon=9.9187&exclude=minutely&units=metric",
	}},
	{Name: "Svendborg", URLs: map[Site]string{
		SiteTV2: "https://vejr.tv2.dk/vejr/svendborg-2612045",
		// "ids=" is not a typo on this line alone: it is what the previous
		// implementation sent, and only for Svendborg. DMI answers it, so it is
		// carried over verbatim rather than "corrected" to id= untested.
		SiteDMI: "https://www.dmi.dk/NinJo2DmiDk/ninjo2dmidk?cmd=llj&ids=2612045",
		SiteYR:  "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=55.0598&lon=10.6068",
		SiteOWM: "https://api.openweathermap.org/data/2.5/forecast?lat=55.0598&lon=10.6068&exclude=minutely&units=metric",
	}},
}

// CityNames returns the display names, in response order.
func CityNames() []string {
	names := make([]string, 0, len(cities))
	for _, c := range cities {
		names = append(names, c.Name)
	}
	return names
}

// lookup finds a city by name, case-insensitively.
//
// An empty name means the caller passed no ?city= and gets the default. An
// unknown name is not defaulted: the old getUrl produced an undefined URL for
// it, which made every source answer null, and callers still distinguish "no
// city asked for" from "that city does not exist".
func lookup(name string) (City, bool) {
	if name == "" {
		name = DefaultCity
	}
	for _, c := range cities {
		if strings.EqualFold(c.Name, name) {
			return c, true
		}
	}
	return City{}, false
}
