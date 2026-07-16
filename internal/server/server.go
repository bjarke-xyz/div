// Package server wires the JSON API and the embedded frontend onto one mux.
//
// There is no web framework here, and no CORS layer: the API is only ever
// called by the pages this same binary serves, from the same origin.
package server

import (
	"crypto/subtle"
	"encoding/json"
	"io/fs"
	"log/slog"
	"net/http"
	"time"

	"github.com/bjarke-xyz/div/internal/fooddays"
	"github.com/bjarke-xyz/div/internal/va"
)

type Server struct {
	va       *va.Service
	fooddays *fooddays.Service
	jobKey   string
	dist     fs.FS
}

func New(vaService *va.Service, foodDaysService *fooddays.Service, jobKey string, dist fs.FS) *Server {
	return &Server{va: vaService, fooddays: foodDaysService, jobKey: jobKey, dist: dist}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/dates/naturaldate/parse", s.handleParseDate)
	mux.HandleFunc("GET /api/food-days/events", s.handleFoodDays)
	mux.HandleFunc("GET /api/va/cities", s.handleCities)
	mux.HandleFunc("GET /api/va/sun", s.handleSun)
	mux.HandleFunc("GET /api/va/weather", s.handleWeather)
	mux.HandleFunc("GET /api/va/proxy/dmi/symbol/{id}/icon.svg", s.handleDMIIcon)
	mux.Handle("POST /api/va/cache-refresh", s.requireJobKey(s.handleCacheRefresh))

	// Registered last and as a bare prefix: it is the catch-all, and every
	// route above is more specific, so ServeMux prefers them.
	mux.Handle("/", spaHandler(s.dist))

	return logRequests(mux)
}

// requireJobKey guards the endpoints that cost upstream traffic. An unset
// JOB_KEY rejects everything rather than waving everyone through — cache-refresh
// fans out to 24 requests across four sites, and used to be open to anyone who
// guessed the path.
func (s *Server) requireJobKey(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.jobKey == "" {
			slog.Warn("JOB_KEY is not set; refusing", "path", r.URL.Path)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		given := r.Header.Get("Authorization")
		if subtle.ConstantTimeCompare([]byte(given), []byte(s.jobKey)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("write json failed", "error", err)
	}
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(start))
	})
}
