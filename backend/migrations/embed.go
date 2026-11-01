// Package migrations contains the Goose history for the standalone Docker database.
// The original Supabase migration history remains unchanged for existing deployments.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
