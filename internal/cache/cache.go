// Package cache is a TTL key/value store over a single SQLite table, with an
// in-memory tier in front of it.
//
// It replaces a Cloudflare R2 bucket that held exactly the same thing: scraped
// HTML and JSON, each with an expiry. Nothing here is authoritative — every
// value can be re-fetched from the site it came from — so a miss is ordinary
// and cheap, and losing the database entirely costs one round of re-scraping.
package cache

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

type memoryItem struct {
	value     string
	expiresAt int64
}

type Cache struct {
	db    *sql.DB
	inmem sync.Map
}

func New(db *sql.DB) *Cache {
	return &Cache{db: db}
}

// Set writes a value that expires ttl from now. Callers that only cache to
// avoid load can ignore the error: a failed write costs a re-fetch, not
// correctness.
func (c *Cache) Set(ctx context.Context, key string, value string, ttl time.Duration) error {
	expiresAt := time.Now().UTC().Add(ttl).Unix()
	c.inmem.Store(key, memoryItem{value: value, expiresAt: expiresAt})

	_, err := c.db.ExecContext(ctx,
		`INSERT INTO cache (k, v, expires_at) VALUES (?, ?, ?)
		 ON CONFLICT DO UPDATE SET v = excluded.v, expires_at = excluded.expires_at`,
		key, value, expiresAt)
	if err != nil {
		return fmt.Errorf("error inserting key %v: %w", key, err)
	}
	return nil
}

// Get returns ("", nil) for both a miss and an expired entry — absence is not
// an error, and callers branch on the empty string.
func (c *Cache) Get(ctx context.Context, key string) (string, error) {
	now := time.Now().UTC().Unix()
	if item, ok := c.inmem.Load(key); ok {
		memitem := item.(memoryItem)
		if memitem.expiresAt > now {
			return memitem.value, nil
		}
	}

	// Expiry is filtered in the WHERE clause so an expired row reads as a miss
	// without a second round trip to delete it. DeleteExpired does the sweeping.
	// expires_at is selected rather than recomputed, so promoting the row into
	// the memory tier keeps the deadline it was written with.
	var value string
	var expiresAt int64
	err := c.db.QueryRowContext(ctx, "SELECT v, expires_at FROM cache WHERE k = ? AND expires_at > ? LIMIT 1", key, now).Scan(&value, &expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("error getting from cache, key=%v: %w", key, err)
	}
	c.inmem.Store(key, memoryItem{value: value, expiresAt: expiresAt})
	return value, nil
}

// SetObj stores v as JSON.
func (c *Cache) SetObj(ctx context.Context, key string, v any, ttl time.Duration) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.Set(ctx, key, string(b), ttl)
}

// GetObj reports whether the key was present and decoded into target.
func (c *Cache) GetObj(ctx context.Context, key string, target any) (bool, error) {
	value, err := c.Get(ctx, key)
	if err != nil || value == "" {
		return false, err
	}
	if err := json.Unmarshal([]byte(value), target); err != nil {
		return false, err
	}
	return true, nil
}

// DeleteExpired drops rows no read would return anyway. Nothing calls it on a
// timer; it runs at boot and after a refresh, which is often enough for a
// cache this small.
func (c *Cache) DeleteExpired(ctx context.Context) error {
	now := time.Now().UTC().Unix()
	c.inmem.Range(func(key, value any) bool {
		if value.(memoryItem).expiresAt < now {
			c.inmem.Delete(key)
		}
		return true
	})

	if _, err := c.db.ExecContext(ctx, "DELETE FROM cache WHERE expires_at < ?", now); err != nil {
		return fmt.Errorf("error deleting from cache: %w", err)
	}
	return nil
}
