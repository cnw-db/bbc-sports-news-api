# BBC Sport News API

A small **Node.js + Express** API that reads the public BBC Sport category pages, discovers current article URLs, fetches each article, and returns structured JSON containing the title, description, thumbnail, timestamps, category, URL, live status, and full article text when available.

> Use this only in a manner consistent with BBC terms, robots guidance, copyright law, and reasonable request rates. The API returns BBC-hosted content and image URLs; it does not grant republication rights.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Service health check |
| `GET /api/news?limit=10` | Latest items from all BBC Sport |
| `GET /api/news/football?limit=10` | Latest football items |
| `GET /api/news/cricket?limit=10` | Latest cricket items |
| `GET /api/news/football?limit=5&full=false` | Football listing without fetching full article bodies |

`limit` is capped at 30. Full article fetching is enabled by default; pass `full=false` when only card data is needed. Results are cached for five minutes by default, which reduces load on BBC servers.

## Cloudflare Workers deployment

This repository includes `src/worker.js` and `wrangler.toml` for Cloudflare Workers. Authenticate Wrangler with `npx wrangler login`, choose a unique Worker name in `wrangler.toml`, test with `npm run cf:dev`, and deploy with `npm run deploy`. After deployment, the public endpoints are `/api/news`, `/api/news/football`, `/api/news/cricket`, and `/health` on the Worker URL.

The JSON envelope and each item include `creator: "whiteshadow"`. Change the value in `wrangler.toml` under `[vars]` before deployment if you want a different public creator name.

## Run locally

```bash
npm install
npm start
```

The server listens on `http://localhost:3000` by default. You can change the port and cache duration:

```bash
PORT=8080 CACHE_TTL_MS=600000 npm start
```

Example request:

```bash
curl 'http://localhost:3000/api/news/football?limit=3'
```

Each item has this shape:

```json
{
  "id": "article-id",
  "title": "Article title",
  "description": "Article description",
  "summary": "Card summary when available",
  "category": "football",
  "url": "https://www.bbc.com/sport/football/articles/example",
  "thumbnail": "https://ichef.bbci.co.uk/example.jpg",
  "publishedAt": "2026-08-29T10:00:00.000Z",
  "updatedAt": null,
  "content": "Full article text separated into paragraphs.",
  "isLive": false
}
```

## Implementation notes

The scraper uses BBC's current public URL patterns (`articles`, `live`, and `scorecard`), JSON-LD metadata when present, Open Graph metadata as a fallback, and semantic paragraph selectors for the article body. BBC can change its markup at any time, so the parser deliberately has fallbacks and returns `scrapeError` per item instead of failing the entire response.

For a production deployment, put the API behind HTTPS, keep the request rate low, add a persistent cache such as Redis, set a descriptive `USER_AGENT`, and consider returning only links and short metadata unless you have the rights to redistribute article text and images.

## Two practical hosting options

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---:|
| Run this Node service on a normal VPS or managed Node host | Full control and persistent cache; requires deployment and monitoring | Depends on provider | Medium |
| Run it locally or on a temporary server for development | Fastest and cheapest for testing; not reliably available to public clients | Usually free for local use | Low |

The included project is deliberately provider-neutral so it can be deployed to Render, Railway, Fly.io, a VPS, or another Node-compatible host.
