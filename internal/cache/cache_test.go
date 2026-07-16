package cache

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func newTestCache(t *testing.T) *Cache {
	t.Helper()

	// A real file rather than :memory:, so the schema and pragmas are exercised
	// the way they are in production.
	path := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	schema, err := os.ReadFile("../../schema.sql")
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	if _, err := db.Exec(string(schema)); err != nil {
		t.Fatalf("apply schema: %v", err)
	}
	return New(db)
}

func TestSetGet(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t)

	if err := c.Set(ctx, "k", "v", time.Hour); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := c.Get(ctx, "k")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "v" {
		t.Errorf("Get = %q, want %q", got, "v")
	}
}

func TestGetMissIsNotAnError(t *testing.T) {
	// Callers branch on the empty string; a miss is the normal case, not a
	// failure, and must not be logged or escalated as one.
	got, err := newTestCache(t).Get(context.Background(), "absent")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "" {
		t.Errorf("Get = %q, want empty", got)
	}
}

func TestGetExpiredIsAMiss(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t)

	if err := c.Set(ctx, "k", "v", -time.Second); err != nil {
		t.Fatalf("Set: %v", err)
	}
	// Expired in both tiers: the memory entry must not answer for a row the SQL
	// WHERE clause would filter out.
	got, err := c.Get(ctx, "k")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "" {
		t.Errorf("Get = %q, want empty", got)
	}
}

func TestSetOverwrites(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t)

	if err := c.Set(ctx, "k", "old", time.Hour); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if err := c.Set(ctx, "k", "new", time.Hour); err != nil {
		t.Fatalf("Set: %v", err)
	}
	got, err := c.Get(ctx, "k")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "new" {
		t.Errorf("Get = %q, want %q", got, "new")
	}
}

func TestGetSurvivesEmptyMemoryTier(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t)

	if err := c.Set(ctx, "k", "v", time.Hour); err != nil {
		t.Fatalf("Set: %v", err)
	}
	// Stand in for a restart: the row is in SQLite but nothing is in memory. A
	// hit here has to keep the deadline it was written with, not be re-dated.
	c.inmem.Clear()

	got, err := c.Get(ctx, "k")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got != "v" {
		t.Errorf("Get = %q, want %q", got, "v")
	}
	if got, err = c.Get(ctx, "k"); err != nil || got != "v" {
		t.Errorf("second Get = %q, %v; want %q — promoted entry expired immediately", got, err, "v")
	}
}

func TestObjRoundTrip(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t)

	type item struct {
		Name string `json:"name"`
	}
	if err := c.SetObj(ctx, "k", []item{{Name: "a"}}, time.Hour); err != nil {
		t.Fatalf("SetObj: %v", err)
	}

	var got []item
	found, err := c.GetObj(ctx, "k", &got)
	if err != nil {
		t.Fatalf("GetObj: %v", err)
	}
	if !found || len(got) != 1 || got[0].Name != "a" {
		t.Errorf("GetObj = %v, %+v", found, got)
	}

	// A miss reports found=false without touching target.
	var absent []item
	if found, err := c.GetObj(ctx, "absent", &absent); err != nil || found {
		t.Errorf("GetObj(absent) = %v, %v; want false, nil", found, err)
	}
}

func TestDeleteExpired(t *testing.T) {
	ctx := context.Background()
	c := newTestCache(t)

	if err := c.Set(ctx, "fresh", "v", time.Hour); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if err := c.Set(ctx, "stale", "v", -time.Hour); err != nil {
		t.Fatalf("Set: %v", err)
	}
	if err := c.DeleteExpired(ctx); err != nil {
		t.Fatalf("DeleteExpired: %v", err)
	}

	var n int
	if err := c.db.QueryRow("SELECT count(*) FROM cache").Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 1 {
		t.Errorf("got %d rows, want 1 — only the expired row should go", n)
	}
	if got, _ := c.Get(ctx, "fresh"); got != "v" {
		t.Errorf("fresh entry was swept: %q", got)
	}
}
