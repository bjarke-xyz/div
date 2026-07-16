package fooddays

import (
	"testing"
	"time"
)

// parsoidPage mirrors what Wikipedia serves today: each country is a <section>,
// the heading sits in a <div class="mw-heading">, and .mw-headline is gone. The
// United States keeps its tables in nested subsections — the shape that a
// sibling scan from the heading cannot reach.
const parsoidPage = `<html><body>
<section data-mw-section-id="1">
  <div class="mw-heading mw-heading2"><h2 id="Global_or_international">Global or international</h2></div>
  <table class="wikitable sortable"><tbody>
    <tr><th>Date</th><th>Event</th><th>Origin</th><th>Notes</th><th>Image</th></tr>
    <tr><td>March 14</td><td>Pi Day</td><td>United States</td><td/><td><img src="//example.org/pie.jpg"/></td></tr>
    <tr><td>Movable</td><td>Shrove Tuesday</td><td>Medieval</td><td/><td/></tr>
  </tbody></table>
</section>
<section data-mw-section-id="2">
  <div class="mw-heading mw-heading2"><h2 id="Brazil">Brazil</h2></div>
  <table class="wikitable"><tbody>
    <tr><th>Date</th><th>Event</th><th>Origin</th></tr>
    <tr><td>June 24</td><td>Festa Junina</td><td>Brazil</td></tr>
  </tbody></table>
</section>
<section data-mw-section-id="3">
  <div class="mw-heading mw-heading2"><h2 id="United_States">United States</h2></div>
  <p>As of 2014, the United States had over 365 days.</p>
  <section data-mw-section-id="4">
    <div class="mw-heading mw-heading3"><h3>January</h3></div>
    <table class="wikitable"><tbody>
      <tr><th>Date</th><th>Event</th><th>Origin</th></tr>
      <tr><td>January 1</td><td>Bloody Mary Day</td><td>US</td></tr>
    </tbody></table>
  </section>
  <section data-mw-section-id="5">
    <div class="mw-heading mw-heading3"><h3>February</h3></div>
    <table class="wikitable"><tbody>
      <tr><th>Date</th><th>Event</th><th>Origin</th></tr>
      <tr><td>February 9</td><td>Bagel Day</td><td>US</td></tr>
    </tbody></table>
  </section>
</section>
<section data-mw-section-id="6">
  <div class="mw-heading mw-heading2"><h2 id="See_also">See also</h2></div>
  <ul><li>Nothing here</li></ul>
</section>
</body></html>`

// legacyPage is the older flat markup the parser was originally written
// against, kept working because the page is not served identically to everyone.
const legacyPage = `<html><body>
<h2><span class="mw-headline" id="Global_or_International">Global or International</span></h2>
<table class="wikitable"><tbody>
  <tr><th>Date</th><th>Event</th><th>Origin</th></tr>
  <tr><td>March 14</td><td>Pi Day</td><td>United States</td></tr>
</tbody></table>
<h2><span class="mw-headline" id="Brazil">Brazil</span></h2>
<table class="wikitable"><tbody>
  <tr><th>Date</th><th>Event</th><th>Origin</th></tr>
  <tr><td>June 24</td><td>Festa Junina</td><td>Brazil</td></tr>
</tbody></table>
</body></html>`

func byEvent(events []DayEvent, name string) *DayEvent {
	for i := range events {
		if events[i].Event == name {
			return &events[i]
		}
	}
	return nil
}

func TestParseWikipediaParsoid(t *testing.T) {
	events, err := parseWikipedia(parsoidPage)
	if err != nil {
		t.Fatalf("parseWikipedia: %v", err)
	}
	// Five data rows across four sections; header rows and "See also" contribute
	// nothing.
	if len(events) != 5 {
		t.Fatalf("got %d events, want 5: %+v", len(events), events)
	}

	pi := byEvent(events, "Pi Day")
	if pi == nil {
		t.Fatal("Pi Day missing")
	}
	// The heading normalises even though the page now lowercases "international".
	if pi.Country != "International" {
		t.Errorf("country = %q, want International", pi.Country)
	}
	// Year 1970: only month and day mean anything, and the frontend re-years it.
	if want := time.Date(1970, 3, 14, 0, 0, 0, 0, time.UTC); !pi.Date.Equal(want) {
		t.Errorf("date = %v, want %v", pi.Date, want)
	}
	if pi.Details != "Origin: United States" {
		t.Errorf("details = %q", pi.Details)
	}
	if pi.ImageUrl != "//example.org/pie.jpg" {
		t.Errorf("imageUrl = %q", pi.ImageUrl)
	}

	// An unparseable date keeps the row at the epoch rather than dropping it.
	shrove := byEvent(events, "Shrove Tuesday")
	if shrove == nil {
		t.Fatal("Shrove Tuesday missing")
	}
	if !shrove.Date.Equal(time.Unix(0, 0).UTC()) {
		t.Errorf("date = %v, want epoch", shrove.Date)
	}

	// Both US subsection tables are read; every other country stops at its first.
	if bagel := byEvent(events, "Bagel Day"); bagel == nil {
		t.Error("Bagel Day missing: the second US table was not read")
	}
	if bloody := byEvent(events, "Bloody Mary Day"); bloody == nil || bloody.Country != "United States" {
		t.Error("Bloody Mary Day missing or miscountried")
	}
}

func TestParseWikipediaSorted(t *testing.T) {
	events, err := parseWikipedia(parsoidPage)
	if err != nil {
		t.Fatalf("parseWikipedia: %v", err)
	}
	for i := 1; i < len(events); i++ {
		if events[i].Date.Before(events[i-1].Date) {
			t.Fatalf("not sorted at %d: %v before %v", i, events[i].Date, events[i-1].Date)
		}
	}
}

func TestParseWikipediaLegacy(t *testing.T) {
	events, err := parseWikipedia(legacyPage)
	if err != nil {
		t.Fatalf("parseWikipedia: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("got %d events, want 2: %+v", len(events), events)
	}
	if pi := byEvent(events, "Pi Day"); pi == nil || pi.Country != "International" {
		t.Errorf("legacy markup: Pi Day = %+v", pi)
	}
	if fj := byEvent(events, "Festa Junina"); fj == nil || fj.Country != "Brazil" {
		t.Errorf("legacy markup: Festa Junina = %+v", fj)
	}
}

func TestToday(t *testing.T) {
	events := []DayEvent{
		{Event: "Pi Day", Date: time.Date(1970, 3, 14, 0, 0, 0, 0, time.UTC)},
		{Event: "Bagel Day", Date: time.Date(1970, 2, 9, 0, 0, 0, 0, time.UTC)},
	}
	// Matched on month and day only: the stored year is 1970 and "now" is not.
	got := Today(events, time.Date(2026, 3, 14, 13, 0, 0, 0, time.UTC))
	if len(got) != 1 || got[0].Event != "Pi Day" {
		t.Errorf("got %+v, want just Pi Day", got)
	}
	if got := Today(events, time.Date(2026, 12, 25, 0, 0, 0, 0, time.UTC)); len(got) != 0 {
		t.Errorf("got %+v, want none", got)
	}
}
