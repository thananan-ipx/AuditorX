FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -o /out/auditorx-api ./cmd/api
RUN CGO_ENABLED=0 go build -trimpath -o /out/auditorx-migrate ./cmd/migrate

FROM alpine:3.22
RUN adduser -D -H auditorx
USER auditorx
COPY --from=build /out/auditorx-api /auditorx-api
COPY --from=build /out/auditorx-migrate /auditorx-migrate
EXPOSE 8080
ENTRYPOINT ["/auditorx-api"]
