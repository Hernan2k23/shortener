# Architecture

Key decisions behind the **Shortener** service (TinyURL with NestJS, MongoDB, Redis, and BullMQ).

## Stack

- **NestJS 11 + TypeScript** — the challenge allows several frameworks. Nest gives us out of the box: dependency injection, modules, global pipes/filters, and the Controller → Service → Repository convention the challenge asks for, without hand-wiring.
- **MongoDB + Mongoose** — required by the challenge (the brief lists "MongoDB / MySQL" as the available options; we picked Mongo because the domain is document-shaped — a single doc per URL, a single doc per click, no joins, with `code` uniqueness enforced by a unique index and surfaced as `E11000` to drive the pool's bounded retry. MySQL would give us transactions we don't need and a fixed schema for data that's likely to grow in shape). Mongoose was chosen as the ODM for the maturity of the Nest ecosystem: typed schemas, declarative indexes, and that same duplicate-key error handling that maps directly to HTTP 409.
- **Redis** — required by the challenge. Used for two things: (1) resolution cache (cache-aside) and (2) BullMQ queue broker. One service covers both needs, no extra infrastructure.
- **BullMQ on Redis** instead of RabbitMQ/Kafka. Rationale: reuses Redis (already required), provides at-least-once delivery, retries with backoff, and automatic dead-letter. The expected click volume of a TinyURL doesn't justify a dedicated broker. Operational simplicity outweighs the flexibility of an AMQP broker.

## Code pool (CodeGenerator)

Code generation is **not** a `nanoid()` per request. It uses a **pre-allocated pool** with a nanoid fallback:

- **`CodeRangeAllocatorService`** keeps an atomic counter in Redis (`INCR`) that hands out disjoint ranges of N codes to each app instance. This prevents two processes from claiming the same range.
- **`BaseAlphabetEncoderService`** converts a numeric offset into a base-N string using a URL-safe alphabet. **`NanoidFallbackEncoder`** is the safety net: if the allocator or encoder fails, it generates a random `nanoid` code instead.
- **`CodePoolService`** requests a block from the allocator when the in-memory pool falls below the threshold (`CODE_POOL_REFILL_THRESHOLD`, default 20%). Each block has `CODE_POOL_SIZE` codes (default 10 000).
- **`CodeShufflerService`** shuffles them before handing them to `take()`, so the visible sequence is not monotonic.
- **`CodeGeneratorService`** exposes `take()` and `release()`: if Mongo returns `E11000` (the code already existed, e.g. because the counter was reset), it does `release()` and `take()` again. Bounded retry (`MAX_RETRIES=2`, 3 total attempts).

> The unique index on `urls.code` remains the ultimate safety net. The pool is an optimization: in 99% of cases persistence doesn't generate a collision, so we avoid the "generate + verify" round-trip on the create hot path.

## Cache-aside (Redis)

`GET url:<code>` with three possible results:

- **Positive hit** (`string`) → returns the URL, records click, redirects.
- **Negative hit** (sentinel) → 404 immediately, no Mongo round-trip.
- **Miss** (`null`) → queries Mongo, repopulates cache, records click, redirects.

TTLs:

- **Positive**: `CACHE_TTL_SECONDS` (default 1h).
- **Negative**: `NEGATIVE_CACHE_TTL_SECONDS` (default 30s). Short on purpose: we don't want to poison Redis with a code someone just created.

Cache writes (`setCode`, `setNegative`) are **fire-and-forget**: a Redis failure doesn't break the resolution.

## Layered structure

```
Controller → Service → Repository
   (HTTP)    (use      (data)
             case)
```

- **Controllers** (`shortener.controller.ts`, `analytics.controller.ts`) — only translate HTTP ↔ service. Validate DTOs, apply throttling, return status codes. The `FallbackController` catches unmatched routes and returns a 404.
- **Services** (`ShortenerService`, `AnalyticsService`, `CodeGeneratorService`) — orchestrate the logic: cache, persistence, queue, code generation.
- **Repositories** (`UrlRepository`, `ClickRepository`, `ClickStatsRepository`) — encapsulate Mongo access. The service doesn't see Mongoose directly. `ClickRepository` persists raw click events and runs the aggregation for stats; `ClickStatsRepository` maintains a pre-aggregated counter document per code via `updateOne` + `$inc`.

The **clicks** pipeline (producer in `queue/`, consumer + repositories + schemas in `analytics/`) lives separately so the async path is easy to reason about and test in isolation.

## Data flow

### Create a short URL — `POST /api/urls`

1. `ValidationPipe` validates the body (`{ originalUrl, alias? }`).
2. If there's an `alias` → goes straight to Mongo. The unique index on `code` guarantees dedup; an `E11000` is translated to 409.
3. If there's no `alias` → `CodeGeneratorService` takes a code from the **pre-allocated pool** (Redis counter, refill in blocks) and persists. If the code already existed (rare, only if the Redis counter was reset), bounded retry.
4. Returns `{ code, shortUrl: <SHORT_BASE_URL>/code }`.

### Resolve and redirect — `GET /:code`

1. **Cache-aside in Redis** — first `GET url:<code>`. Three paths:
   - **Positive hit** → returns the URL, records the click, redirects.
   - **Negative hit** (`NEGATIVE_SENTINEL`) → 404 immediately, no Mongo touch.
   - **Miss** → queries Mongo, repopulates cache (TTL configurable via `CACHE_TTL_SECONDS`), records the click, redirects.
2. **Click recording is fire-and-forget**: `producer.add(...)` is called without await. The redirect is not blocked by the queue.
3. The **negative cache TTL** is short (`NEGATIVE_CACHE_TTL_SECONDS`, 30s default) so we don't poison Redis with a code someone just created.

### Click worker

- `@Processor` in `ClickConsumerService` reads the BullMQ queue (concurrency: 4) and for each job: inserts a `ClickEvent` into the `clicks` collection (idempotent via `eventId` unique index — duplicates are silently ignored), then increments the pre-aggregated `ClickStats` counter for that code.
- The worker runs in the same process as the API. To scale horizontally, run multiple `app` replicas; each registers its own BullMQ worker and jobs are distributed across consumers.

### Stats — `GET /api/stats/:code`

- Simple aggregation over `clicks`: `count` per code + `max(ts)` as `lastClick`. No complex pipelines.

## Point decisions

- **`SHORT_BASE_URL` is optional**, derived from `PORT` by default (`http://localhost:<PORT>`). For deployments with a real domain, set it as an override.
- **A single `PORT`** controls both the in-container port and the host-published port. Fewer variables, less confusion.
- **Codes via `nanoid`** (~7 URL-safe chars, no ambiguous characters) or **custom aliases** validated with regex `^[A-Za-z0-9_-]{3,32}$`.
- **`LoopRedirectGuard`** on `POST /api/urls` — rejects URLs whose hostname matches the shortener itself, preventing infinite redirect loops.
- **Errors with stable shape** `{ statusCode, message, code }` via `AllExceptionsFilter`. Explicit mapping: `E11000` → 409, `NEGATIVE_SENTINEL` → 404, etc.
- **Env validation with Joi** at boot — fails loudly if something is missing, not at the first request.
- **Throttling on `POST /api/urls`** with `@nestjs/throttler` (10 req/min per IP on create, 60 req/min global) to prevent someone from saturating the keyspace.
- **Bull Board at `/admin/queues`** to inspect the queue. Always mounted — gate it behind auth or an env check before production.
- **`tini` as PID 1** in the Dockerfile so `SIGTERM` drains the queue cleanly when the container stops.
