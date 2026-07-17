package main

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// tzdata is embedded so Europe/Copenhagen resolves in a distroless image.
	// TV2 and DMI report local wall-clock time, so without it every forecast
	// timestamp would be wrong.
	_ "time/tzdata"

	"github.com/bjarke-xyz/div/internal/cache"
	"github.com/bjarke-xyz/div/internal/fooddays"
	"github.com/bjarke-xyz/div/internal/logging"
	"github.com/bjarke-xyz/div/internal/server"
	"github.com/bjarke-xyz/div/internal/va"
	_ "modernc.org/sqlite"
)

// dist is the built frontend. It is not in git, so `go build` needs
// `npm run build` to have run first; the Makefile's build target does both.
//
//go:embed all:dist
var distFS embed.FS

//go:embed schema.sql
var schema string

func main() {
	logging.Setup()
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	var (
		dbPath    = env("DB_PATH", "./div.db")
		port      = env("PORT", "3000")
		owmAPIKey = os.Getenv("OWM_API_KEY")
		jobKey    = os.Getenv("JOB_KEY")
	)
	if owmAPIKey == "" {
		slog.Warn("OWM_API_KEY is not set; the owm source and /api/va/sun will be empty")
	}
	if jobKey == "" {
		slog.Warn("JOB_KEY is not set; /api/va/cache-refresh will reject every request")
	}

	// WAL so a slow scrape being written does not block readers, and
	// busy_timeout to absorb the contention that remains. Nothing here binds
	// time.Time, so _time_format is not needed.
	db, err := sql.Open("sqlite", "file:"+dbPath+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return err
	}
	defer db.Close()

	// The schema is idempotent and the data is disposable, so it is replayed on
	// every boot instead of being migrated.
	if _, err := db.Exec(schema); err != nil {
		return err
	}

	dist, err := fs.Sub(distFS, "dist")
	if err != nil {
		return err
	}

	c := cache.New(db)
	if err := c.DeleteExpired(context.Background()); err != nil {
		slog.Error("cache sweep failed", "error", err)
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           server.New(va.NewService(c, owmAPIKey), fooddays.NewService(c), jobKey, dist).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	slog.Info("listening", "addr", srv.Addr, "db", dbPath)
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
