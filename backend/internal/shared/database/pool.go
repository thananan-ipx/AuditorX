package database

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMaxConnections = 5
	connectTimeout        = 10 * time.Second
)

type Pool struct {
	pool *pgxpool.Pool
}

func Connect(ctx context.Context, connectionString string) (*Pool, error) {
	if strings.TrimSpace(connectionString) == "" {
		return nil, nil
	}
	secureURL, err := requireTLS(connectionString)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	config, err := pgxpool.ParseConfig(secureURL)
	if err != nil {
		return nil, fmt.Errorf("configure database pool: %w", err)
	}
	config.MaxConns = defaultMaxConnections
	config.MinConns = 0
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnLifetimeJitter = 5 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute
	config.HealthCheckPeriod = time.Minute
	config.ConnConfig.ConnectTimeout = connectTimeout
	config.ConnConfig.RuntimeParams["application_name"] = "auditorx-api"
	config.ConnConfig.RuntimeParams["statement_timeout"] = "15s"
	config.ConnConfig.RuntimeParams["idle_in_transaction_session_timeout"] = "30s"
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create database pool: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, connectTimeout)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}
	return &Pool{pool: pool}, nil
}

func (p *Pool) Ping(ctx context.Context) error            { return p.pool.Ping(ctx) }
func (p *Pool) Close()                                    { p.pool.Close() }
func (p *Pool) Begin(ctx context.Context) (pgx.Tx, error) { return p.pool.Begin(ctx) }

func requireTLS(connectionString string) (string, error) {
	parsed, err := url.Parse(connectionString)
	if err != nil {
		return "", err
	}
	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return "", fmt.Errorf("unsupported scheme %q", parsed.Scheme)
	}
	if parsed.Hostname() == "" {
		return "", fmt.Errorf("database host is required")
	}
	query := parsed.Query()
	if query.Get("sslmode") == "" {
		query.Set("sslmode", "require")
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}
