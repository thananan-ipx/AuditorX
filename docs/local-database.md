# Local database in Docker

AuditorX runs its development database as part of the local Supabase stack in Docker.
The repository contains everything needed to recreate the database schema on another
computer:

- `supabase/config.toml` configures the local services and PostgreSQL 17.
- `supabase/migrations/*.sql` is the authoritative, ordered schema history.
- `supabase/seed.sql` is applied after the migrations and intentionally contains no
  personal or machine-local data.
- `tools/database-tests/package-lock.json` pins Supabase CLI 2.116.0.

Docker images and database volumes are not committed to Git. A new computer downloads
the images and rebuilds the database from the committed files.

## First start on a new computer

Install Git, Docker Desktop, Node.js 24, and PowerShell 7.4 or newer. Clone the repository,
start Docker Desktop, and run this from the repository root:

```powershell
pwsh ./scripts/database-local.ps1 start
```

The script installs the repository-pinned CLI when it is missing, starts the Supabase
containers, applies every migration, and then applies `seed.sql`. The first run downloads
Docker images and can take several minutes. Supabase Studio is available at
`http://127.0.0.1:54323` after startup.

Useful commands:

```powershell
# Show URLs and local service status
pwsh ./scripts/database-local.ps1 status

# Delete and recreate only the local database from migrations and seed.sql
pwsh ./scripts/database-local.ps1 reset

# Stop the local stack while preserving its Docker volume backup
pwsh ./scripts/database-local.ps1 stop
```

To run the database together with the API, scan worker, and frontend, install the remaining
project prerequisites and use `pwsh ./scripts/dev-local.ps1` instead.

## Data and secrets

The current local volume can contain Auth users, password hashes, repository URLs, uploaded
source, and scan results. Do not commit a dump of that volume, `.env` files, `supabase/.temp`,
or `supabase/.branches`. Create local users through the app after rebuilding the stack.

If real development data must move between computers, make an encrypted backup outside Git
and treat it as sensitive. Schema changes belong in a new versioned migration; never depend
on manual Studio changes that are absent from `supabase/migrations`.
