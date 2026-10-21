# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o pulsenoc-server ./cmd/server

# Runner stage
FROM alpine:3.21 AS runner

WORKDIR /app

RUN apk --no-cache add ca-certificates tzdata curl

COPY --from=builder /app/pulsenoc-server /app/pulsenoc-server

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["/app/pulsenoc-server"]
