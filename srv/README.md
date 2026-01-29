# Wisdom Quote Server

A Node.js server that serves daily quotes from Merlin Mann's [Wisdom Project](http://wisdom.limo).

## Features

- Parses quotes from the official wisdom.md source
- Serves one quote per day, cycling through all quotes before repeating
- Handles "Related:" quote chains (serves related quotes on consecutive days)
- API key authentication
- Automatic daily sync from GitHub source
- SQLite database for tracking

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database and generate admin API key
npm run setup

# Start the server
npm run dev
```

The setup script will display your admin API key. **Save it securely** - it won't be shown again.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot reload (development) |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled version (production) |
| `npm run setup` | Initialize DB and create admin key |
| `npm run sync` | Manually sync quotes from source |
| `npm run generate-key` | Generate a new API key |

### Generate API Key Options

```bash
npm run generate-key -- --name "My App" --admin
```

- `--name <name>` - Description for the key
- `--admin` - Create an admin key

## API Endpoints

### Public (no authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/quote/public` | Get today's quote (rate limited: 10/min per IP) |

### Authenticated (requires API key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/quote` | Get today's quote (full response) |
| GET | `/api/v1/quote/random` | Get a random quote |

### Admin (requires admin API key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/admin/keys` | Generate new API key |
| GET | `/api/v1/admin/keys` | List all API keys |
| DELETE | `/api/v1/admin/keys/:id` | Invalidate an API key |
| POST | `/api/v1/admin/sync` | Force re-sync from source |
| GET | `/api/v1/admin/stats` | Get quote statistics |
| POST | `/api/v1/admin/reset-cycle` | Reset served quotes cycle |
| GET | `/api/v1/admin/rate-limits/keys` | View API key rate limit status |
| GET | `/api/v1/admin/rate-limits/public` | View public IP rate limit status |

## Usage Examples

### Get today's quote

```bash
curl -H "X-API-Key: YOUR_API_KEY" http://localhost:3000/api/v1/quote
```

Response:
```json
{
  "success": true,
  "data": {
    "quote": "Never organize anything you should discard.",
    "quote_html": "Never organize anything you should discard.",
    "id": 42,
    "date": "2026-01-29",
    "is_related": false,
    "chain_info": null,
    "cycle_progress": {
      "served": 156,
      "total": 377
    }
  },
  "meta": {
    "timestamp": "2026-01-29T14:30:00Z",
    "cache_until": "2026-01-30T00:00:00Z"
  }
}
```

### Generate a new API key (admin)

```bash
curl -X POST \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Web Client", "is_admin": false}' \
  http://localhost:3000/api/v1/admin/keys
```

### Force sync quotes

```bash
curl -X POST \
  -H "X-API-Key: YOUR_ADMIN_KEY" \
  http://localhost:3000/api/v1/admin/sync
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Server
NODE_ENV=development
PORT=3000
HOST=127.0.0.1

# Database
DATABASE_PATH=./data/wisdom.db

# Source
WISDOM_SOURCE_URL=https://raw.githubusercontent.com/merlinmann/wisdom/master/wisdom.md

# Sync Schedule (hour in 24h format)
SYNC_HOUR=3

# Security
API_KEY_HEADER=X-API-Key
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Public endpoint rate limiting (stricter, by IP)
PUBLIC_RATE_LIMIT_WINDOW_MS=60000
PUBLIC_RATE_LIMIT_MAX_REQUESTS=10

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Production (behind nginx)
TRUST_PROXY=false
```

## Production with nginx

Example nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name wisdom-api.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `TRUST_PROXY=true` in `.env` when running behind a proxy.

## How Quote Selection Works

1. Each day, the server selects a quote that hasn't been served yet
2. If the selected quote has "Related:" quotes, those are served on subsequent days
3. Once all quotes have been served, the cycle resets
4. The same quote is served all day (cached in `daily_quote` table)

## Database

SQLite database stored at `./data/wisdom.db` with tables:

- `quotes` - All parsed quotes
- `quote_relations` - Links for "Related:" chains
- `served_quotes` - Tracks which quotes have been served
- `daily_quote` - Caches today's quote selection
- `api_keys` - Hashed API keys
- `sync_log` - Sync operation history

## License

MIT
