# Shortener — TinyURL Service

A backend service that generates short URLs, resolves them via redirect, caches resolutions in Redis, and records clicks asynchronously through a message queue, persisting events in MongoDB.

Built with **NestJS 11** + **TypeScript**, **Mongoose**, **ioredis**, and **BullMQ**.

---

## Getting started (Docker Compose)

The fastest way to run the service. You need **Docker** with the Compose v2 plugin.

> Don't have Docker yet? Download **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (includes Docker Engine + Compose v2). It's free and available for macOS, Windows, and Linux. After installing, make sure Docker Desktop is running before executing the commands below.

### 1. Clone and enter the repo

```bash
git clone <repo-url> shortener
cd shortener
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

The defaults work out of the box — Mongo and Redis credentials, ports, cache TTLs, everything.

### 3. Build and start

```bash
docker compose up -d --build
```

This starts three services:

| Service | Image | Port | Purpose |
|---|---|---|---|
| `mongo` | `mongo:7` | `27017` (host) | Persistence of URLs and click events |
| `redis` | `redis:7-alpine` | not published | Cache + BullMQ broker |
| `app` | built locally | `3000` (host) | NestJS API |

### 4. Verify it's up

```bash
docker compose ps
docker compose logs -f app
```

You should see the NestJS bootstrap complete and the worker register. The `app` healthcheck pings `http://localhost:3000/health/ready` every 10s.

### 5. Use it

Open the demo frontend (a static `index.html` served by NestJS's `ServeStaticModule`):

```
http://localhost:3000/
```

Or hit the API directly:

```bash
# Create a short URL
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "https://www.google.com/search?q=nodejs"}'

# Create one with a custom alias
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "https://nestjs.com", "alias": "nest"}'

# Resolve (follows redirect)
curl -i http://localhost:3000/nest

# Get stats
curl http://localhost:3000/api/stats/nest
```

Also available:

- `GET /admin/queues` — Bull Board queue inspector (always mounted; gate behind auth in production)
- `GET /health/ready` — readiness healthcheck

### 6. Run tests

```bash
npm test              # unit tests (Jest)
npm run test:watch    # watch mode
npm run test:cov      # with coverage report
npm run test:e2e      # end-to-end tests (requires running services)
```

### 7. Stop and clean up

```bash
docker compose down            # stop containers, keep the Mongo volume
docker compose down -v         # stop containers and delete the Mongo volume
```

---

## Configuration

All configuration lives in `.env`. Key variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Single source of truth for the port. Used both inside the container and as the host-published port. |
| `MONGO_USERNAME` / `MONGO_PASSWORD` | `shortener` / `shortener` | Seeded into Mongo on first volume init and interpolated into `MONGO_URL`. |
| `MONGO_URL` | `mongodb://...@mongo:27017/shortener?authSource=admin` | Full Mongo connection URI. Override to point at a different host. |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `redis` / `6379` / `shortener` | Redis connection settings. |
| `CACHE_TTL_SECONDS` | `3600` | TTL for the positive resolution cache. |
| `NEGATIVE_CACHE_TTL_SECONDS` | `30` | TTL for "code not found" entries. Short on purpose. |
| `SHORT_BASE_URL` | `http://localhost:<PORT>` | Public base URL returned by `POST /api/urls`. Optional — derived from `PORT` by default. Set this to a real domain in production. |
| `CODE_POOL_SIZE` | `10000` | Codes per refill block (see Architecture doc). |
| `CODE_POOL_REFILL_THRESHOLD` | `0.2` | Refill when the in-memory pool drops below 20%. |
| `MONGO_HOST_PORT` | `27017` | Host port mapped to Mongo's `27017`. Override if the default is taken on your machine. |

> If `PORT` is changed, the `SHORT_BASE_URL` (when not set explicitly) updates automatically and the `docker-compose` mapping updates with it.

---

## Running locally without Docker

If you want to hack on the code with watch-reload:

1. Install deps: `npm install`
2. Start Mongo and Redis locally (e.g. via Docker for those two only)
3. Point `.env` at `localhost`:
   ```env
   MONGO_URL=mongodb://shortener:shortener@localhost:27017/shortener?authSource=admin
   REDIS_HOST=localhost
   REDIS_PASSWORD=shortener
   ```
4. `npm run start:dev` — starts with hot-reload on file changes
5. `npm test` — run unit tests (no external services needed; they're mocked)

---

## Project structure

```
src/
  main.ts                 # bootstrap
  app.module.ts           # root module
  config/                 # env validation (Joi)
  common/                 # filters, guards, decorators, fallback controller
  redis/                  # ioredis client + cache service
  queue/                  # BullMQ producer (ClicksQueueService)
  shortener/              # core feature (create + resolve + redirect)
  analytics/              # click consumer, stats, repositories
  code-generation/        # code pool, allocator, shuffler, nanoid fallback
  health/                 # readiness checks
test/                     # e2e tests
```

Layered architecture: **Controller → Service → Repository**. Controllers handle HTTP, services hold use-cases, repositories own Mongo queries.

---

## Architecture and design decisions

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full write-up: why this stack, the pre-allocated code pool, the cache-aside flow, the BullMQ choice, and what was deliberately left out.

---

## License

UNLICENSED — technical challenge project.
