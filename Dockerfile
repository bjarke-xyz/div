FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json vite.config.ts ./
COPY frontend/ ./frontend/
RUN npm run build

FROM golang:1.26 AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY main.go schema.sql Makefile ./
COPY internal/ ./internal/
# dist/ is go:embed'ed, so it has to be in place before the compile.
COPY --from=frontend /app/dist/ ./dist/
# modernc.org/sqlite is pure Go, so CGO can stay off and the binary is static:
# no libc in the runtime image, and the frontend is embedded, so the binary is
# the whole app.
RUN CGO_ENABLED=0 make go-build

# Created here because distroless has no shell to mkdir with, and the volume
# inherits this ownership: the container runs as nonroot (uid 65532) and has to
# be able to write the database.
RUN mkdir -p /data && chown 65532:65532 /data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=backend /app/div /app/div
COPY --from=backend --chown=65532:65532 /data /data

# The SQLite cache lives here. It is disposable — the volume only saves a cold
# start after a redeploy, and nothing in it is worth backing up.
VOLUME /data
ENV DB_PATH=/data/div.db
EXPOSE 3000

ENTRYPOINT ["/app/div"]
