package server

import (
	"log/slog"
	"net/http"

	"github.com/bjarke-xyz/div/internal/va"
)

func (s *Server) handleCities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, va.CityNames())
}

func (s *Server) handleWeather(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.va.Weather(r.Context(), r.URL.Query().Get("city")))
}

func (s *Server) handleSun(w http.ResponseWriter, r *http.Request) {
	// A nil SunData marshals to null, which is what the frontend expects when
	// OWM has nothing for this city.
	writeJSON(w, http.StatusOK, s.va.Sun(r.Context(), r.URL.Query().Get("city")))
}

func (s *Server) handleDMIIcon(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing symbol id", http.StatusBadRequest)
		return
	}

	svg, err := s.va.Icon(r.Context(), id)
	if err != nil {
		slog.Error("dmi proxy error", "id", id, "error", err)
		http.Error(w, "DMI fetch error", http.StatusInternalServerError)
		return
	}

	// Symbols are immutable, so this is safe to cache in the browser as well as
	// in SQLite. The old s-maxage only spoke to a shared cache, and there is no
	// CDN in front of this.
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=2592000, immutable")
	w.Write([]byte(svg))
}

func (s *Server) handleCacheRefresh(w http.ResponseWriter, r *http.Request) {
	s.va.Refresh(r.Context())
	writeJSON(w, http.StatusOK, map[string]string{"msg": "success"})
}
