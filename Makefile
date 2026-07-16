.PHONY: build go-build dev test clean

BINARY_NAME=div

# go-build compiles the binary, assuming dist/ is already built. The Dockerfile
# builds the frontend in a separate stage and calls this directly.
go-build:
	go build -ldflags="-w -s" -o ${BINARY_NAME} .

# build produces the whole app. The frontend must come first: dist/ is embedded
# into the binary, so go build cannot run without it.
build:
	npm ci && npm run build && $(MAKE) go-build

dev:
	set -a; [ -f .env ] && . ./.env; set +a; go run .

test:
	go test ./...

clean:
	go clean
	rm -f ${BINARY_NAME}
	rm -f div.db div.db-shm div.db-wal
