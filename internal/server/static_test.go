package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

// dist mirrors the shape vite emits: a root shell, one shell per site,
// fingerprinted assets, and files that sit at the root because the browser asks
// for them from any page.
var dist = fstest.MapFS{
	"index.html":             {Data: []byte("root shell")},
	"va/index.html":          {Data: []byte("va shell")},
	"dates/index.html":       {Data: []byte("dates shell")},
	"va/img/yr/sleet.png":    {Data: []byte("png bytes")},
	"assets/index-abc123.js": {Data: []byte("console.log(1)")},
	"date.txt":               {Data: []byte("2026-07-16")},
	"sp_favicon.ico":         {Data: []byte("icon")},
}

func get(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	spaHandler(dist).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestServesRealFiles(t *testing.T) {
	// These used to need a serveStatic registration each; they now resolve
	// because they exist in dist.
	tests := map[string]string{
		"/date.txt":               "2026-07-16",
		"/sp_favicon.ico":         "icon",
		"/va/img/yr/sleet.png":    "png bytes",
		"/assets/index-abc123.js": "console.log(1)",
	}
	for path, want := range tests {
		rec := get(t, path)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, want 200", path, rec.Code)
			continue
		}
		if rec.Body.String() != want {
			t.Errorf("%s: body = %q, want %q", path, rec.Body.String(), want)
		}
	}
}

func TestSPAFallbackFindsNearestShell(t *testing.T) {
	// A client-routed path has no file of its own and has to land on its own
	// site's shell, not the root one.
	tests := map[string]string{
		"/":              "root shell",
		"/va/":           "va shell",
		"/va":            "va shell",
		"/va/deep/link":  "va shell",
		"/dates/":        "dates shell",
		"/nonsense":      "root shell",
		"/nonsense/deep": "root shell",
	}
	for path, want := range tests {
		rec := get(t, path)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, want 200", path, rec.Code)
			continue
		}
		if rec.Body.String() != want {
			t.Errorf("%s: body = %q, want %q", path, rec.Body.String(), want)
		}
	}
}

func TestMissingAssetIs404(t *testing.T) {
	// The important one: falling back to index.html here would hand the browser
	// HTML where it expects JavaScript, and the syntax error it raises hides the
	// actual missing file.
	rec := get(t, "/assets/missing.js")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404 (body: %q)", rec.Code, rec.Body.String())
	}
}

func TestAssetsAreImmutableAndShellsAreNot(t *testing.T) {
	// Asset filenames are fingerprinted, so they can be cached forever. A shell
	// is not, and points at the hashed bundles — caching it would pin the
	// browser to a deleted build.
	if got := get(t, "/assets/index-abc123.js").Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
		t.Errorf("asset Cache-Control = %q", got)
	}
	if got := get(t, "/va/").Header().Get("Cache-Control"); got != "no-cache" {
		t.Errorf("shell Cache-Control = %q, want no-cache", got)
	}
}
