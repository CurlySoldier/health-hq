# Health HQ

Self-hosted health, training, and savings platform with a modular-monolith .NET backend and React frontend.

## Stack

- Backend: .NET 10 (modular monolith, separate csproj per module)
- Frontend: React + Vite
- Data: SQLite file-based storage with JSON payload documents
- Ingestion: Strava OAuth + polling sync + GarminDB sidecar + import polling
- Deployment: single Docker image, GHCR pipeline on `main`

## Run locally with Docker

1. Set env vars for Strava (optional if you only use Garmin):

```bash
export STRAVA_CLIENT_ID=your_client_id
export STRAVA_CLIENT_SECRET=your_client_secret
export STRAVA_REDIRECT_URI=http://localhost:8080/api/ingestion/strava/oauth/callback
export GARMIN_SYNC_INTERVAL_MINUTES=60
export GARMIN_BACKOFF_STEP_MINUTES=15
export GARMIN_MAX_BACKOFF_MINUTES=360
```

2. Build and run:

```bash
docker build -t health-hq:local .
docker run --rm -p 8080:8080 -v healthhq-data:/app/data \
  -e Strava__ClientId=$STRAVA_CLIENT_ID \
  -e Strava__ClientSecret=$STRAVA_CLIENT_SECRET \
  -e Strava__RedirectUri=$STRAVA_REDIRECT_URI \
  health-hq:local
```

3. Open `http://localhost:8080`.

## Run with Docker Compose (recommended)

The compose stack runs both `health-hq` and `garmin-db`.

```bash
docker compose -f deploy/docker-compose.yml up --build -d
```

Then open `http://localhost:18080`, navigate to Connections, and enter Garmin username/password there.
Health HQ encrypts credentials at rest, writes GarminDB runtime config into `/app/data/garmin/.GarminDb`, and the Garmin sidecar performs periodic downloads.

## Strava setup

Strava is opt-in and disabled by default. Enable it in Settings > Connections before connecting.

1. Create a Strava API application at `https://www.strava.com/settings/api`.
2. Use your server callback URL in the app settings.
3. In Health HQ, open Connections and request the connect URL.
4. Complete OAuth and then run sync.

## Garmin setup

1. Start the compose stack.
2. In Health HQ, open Connections and enter Garmin username/password.
3. Save credentials; this creates GarminDB config files under `/app/data/garmin/.GarminDb`.
4. Use "Sync Garmin Import Now" to import downloaded Garmin activities into Health HQ.

Notes:
- Garmin raw history and GarminDB SQLite files remain under `/app/data/garmin/HealthData` for long-term reference.
- Health HQ keeps its own app DB at `/app/data/healthhq.db` and imports Garmin activities idempotently.
- ASP.NET Data Protection keys are persisted at `/app/data/keys` so encrypted credentials survive container recreation.
- The Garmin sidecar increases sync delay after login/rate-limit failures to avoid repeated lockouts.

## Notes

- Frontend themes can be validated with `npm run theme:check` in `src/frontend/web`.
- Install local git hooks with `sh scripts/install-git-hooks.sh` to enforce `theme:check` on every commit.
- No authentication is enabled (trusted LAN only).
- Parsed JSON payloads are stored in SQLite; source PDFs are not retained.
- Health HQ does not seed demo data automatically; all records come from sync/import flows or manual entry.
