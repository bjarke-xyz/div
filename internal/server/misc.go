package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/bjarke-xyz/div/internal/fooddays"
	"github.com/olebedev/when"
	"github.com/olebedev/when/rules/common"
	"github.com/olebedev/when/rules/en"
)

// parser understands English relative and absolute date phrases. It replaces
// chrono-node, which has no Go equivalent of the same reach: phrases like
// "5 minutes ago" or "next friday" resolve, more baroque ones do not and come
// back as a null output, which the endpoint has always been able to express.
var parser = newParser()

func newParser() *when.Parser {
	p := when.New(nil)
	p.Add(en.All...)
	p.Add(common.All...)
	return p
}

type parseDateRequest struct {
	NaturalDate string `json:"naturalDate"`
}

type parseDateResponse struct {
	Input string `json:"input"`
	// A pointer so a failed parse serialises as null rather than "": the
	// frontend reads only this field and treats null as "could not parse".
	Output *string `json:"output"`
}

func (s *Server) handleParseDate(w http.ResponseWriter, r *http.Request) {
	var body parseDateRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.NaturalDate == "" {
		// The old handler called c.status(400), which returns no response at
		// all in Hono, so this path used to hang up with an empty body.
		http.Error(w, "naturalDate is required", http.StatusBadRequest)
		return
	}

	resp := parseDateResponse{Input: body.NaturalDate}
	result, err := parser.Parse(body.NaturalDate, time.Now())
	if err != nil {
		slog.Error("natural date parse failed", "input", body.NaturalDate, "error", err)
	}
	if result != nil {
		output := result.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		resp.Output = &output
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleFoodDays(w http.ResponseWriter, r *http.Request) {
	events, err := s.fooddays.Events(r.Context())
	if err != nil {
		slog.Error("get food days failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not get food days"})
		return
	}

	if r.URL.Query().Get("today") == "true" {
		events = fooddays.Today(events, time.Now())
	}
	writeJSON(w, http.StatusOK, events)
}
