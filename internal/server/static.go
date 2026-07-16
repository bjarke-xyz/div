package server

import (
	"io/fs"
	"log/slog"
	"net/http"
	"path"
	"strings"
)

// spaHandler serves the embedded frontend.
//
// The build is multi-page: vite emits dist/index.html plus one index.html per
// site (dist/va/, dist/dates/, …), and each of those is a client-routed SPA. A
// request that names no real file therefore has to find the right shell, which
// it does by walking up the path — /va/anything resolves to dist/va/index.html.
// That derives the site list from what was actually built, so adding a page to
// frontend/ needs no change here.
func spaHandler(dist fs.FS) http.Handler {
	files := http.FileServerFS(dist)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		isAsset := strings.HasPrefix(r.URL.Path, "/assets/")

		if info, err := fs.Stat(dist, name); err == nil && !info.IsDir() {
			// Vite fingerprints these filenames, so their contents can never
			// change under a given URL.
			if isAsset {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			files.ServeHTTP(w, r)
			return
		}

		// A missing asset must 404 rather than fall back: serving index.html
		// here would hand the browser HTML where it expects JavaScript, and the
		// parse error it produces hides the real problem.
		if isAsset {
			http.NotFound(w, r)
			return
		}

		serveIndex(w, dist, findIndex(dist, name))
	})
}

// findIndex walks up from the requested path to the nearest index.html,
// falling back to the root shell.
func findIndex(dist fs.FS, name string) string {
	for dir := name; dir != "." && dir != "/" && dir != ""; dir = path.Dir(dir) {
		candidate := path.Join(dir, "index.html")
		if info, err := fs.Stat(dist, candidate); err == nil && !info.IsDir() {
			return candidate
		}
	}
	return "index.html"
}

// serveIndex writes a shell directly rather than delegating to the file server,
// which would redirect /va/ to /va/index.html and expose the layout in the URL.
func serveIndex(w http.ResponseWriter, dist fs.FS, name string) {
	body, err := fs.ReadFile(dist, name)
	if err != nil {
		slog.Error("read index failed", "name", name, "error", err)
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	// The shells are not fingerprinted and are what point at the hashed bundles,
	// so a stale one would pin the browser to a deleted build.
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Write(body)
}
