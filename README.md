<div align="center">

# BBC Sport News API

**Fast, lightweight BBC Sport news scraping API with thumbnails, metadata, and full article content.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open%20API-111827?style=for-the-badge&logo=cloudflare&logoColor=F38020)](https://bbc-sports-news-api.newbot1952.workers.dev/)
[![Follow WhatsApp Channel](https://img.shields.io/badge/Follow-WhatsApp%20Channel-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com/channel/0029Vak4dFAHQbSBzyxlGG13)

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)
[![GitHub forks](https://img.shields.io/github/forks/cnw-db/bbc-sports-news-api?style=flat-square)](https://github.com/cnw-db/bbc-sports-news-api/network/members)
[![GitHub views](https://komarev.com/ghpvc/?username=cnw-db&label=Repo%20views&color=blue&style=flat-square)](https://github.com/cnw-db/bbc-sports-news-api)

</div>

> A community-friendly API project by **whiteshadow**. Please use it responsibly and respect BBC terms, copyright, robots guidance, and reasonable request rates.

## Live demo

The deployed API is available at **[bbc-sports-news-api.newbot1952.workers.dev](https://bbc-sports-news-api.newbot1952.workers.dev/)**. Open the root URL to see the endpoint directory, or use one of the direct links below.

| Endpoint | Description | Live link |
|---|---|---|
| `GET /` | Interactive API homepage | [Open homepage](https://bbc-sports-news-api.newbot1952.workers.dev/) |
| `GET /api/news` | Latest news from all BBC Sport | [Open endpoint](https://bbc-sports-news-api.newbot1952.workers.dev/api/news) |
| `GET /api/news/football` | Latest football news | [Open endpoint](https://bbc-sports-news-api.newbot1952.workers.dev/api/news/football) |
| `GET /api/news/cricket` | Latest cricket news | [Open endpoint](https://bbc-sports-news-api.newbot1952.workers.dev/api/news/cricket) |
| `GET /health` | Service health check | [Check status](https://bbc-sports-news-api.newbot1952.workers.dev/health) |

## Quick examples

Fetch three football items:

```bash
curl "https://bbc-sports-news-api.newbot1952.workers.dev/api/news/football?limit=3"
```

Fetch cricket cards without full article bodies:

```bash
curl "https://bbc-sports-news-api.newbot1952.workers.dev/api/news/cricket?limit=10&full=false"
```

The `limit` parameter accepts values from 1 to 30. Full article fetching is enabled by default; use `full=false` when you need a faster, lighter response. Results are cached for approximately five minutes to reduce repeated requests to the source site.

## Response format

Every response includes the public creator name, source URL, timestamp, item count, and data array. Each news item can include its title, summary, description, thumbnail, article URL, timestamps, live status, and full text.

```json
{
  "success": true,
  "creator": "whiteshadow",
  "category": "football",
  "count": 1,
  "data": [
    {
      "id": "article-id",
      "title": "Article title",
      "summary": "Short card summary",
      "description": "Article description",
      "category": "football",
      "url": "https://www.bbc.com/sport/football/articles/example",
      "thumbnail": "https://ichef.bbci.co.uk/example.jpg",
      "publishedAt": "2026-08-29T10:00:00.000Z",
      "updatedAt": null,
      "content": "Full article text separated into paragraphs.",
      "isLive": false,
      "creator": "whiteshadow"
    }
  ]
}
```

## Run locally

```bash
git clone https://github.com/cnw-db/bbc-sports-news-api.git
cd YOUR_REPOSITORY
npm install
npm start
```

The local Express server runs at `http://localhost:3000`. Configure it with environment variables when needed:

```bash
PORT=8080 CACHE_TTL_MS=600000 CREATOR=whiteshadow npm start
```

## Deploy to Cloudflare Workers

The repository includes a Cloudflare-compatible Worker entrypoint at `src/worker.js` and deployment settings in `wrangler.toml`.

```bash
npm install
npx wrangler login
npm run cf:dev
npm run deploy
```

Before deploying, change the `name` value in `wrangler.toml` if the Worker name is already taken. The public creator value is configured under `[vars]`.

## Project structure

| File | Purpose |
|---|---|
| `src/worker.js` | Cloudflare Workers API and HTML landing page |
| `src/server.js` | Local Node.js + Express version |
| `wrangler.toml` | Cloudflare Worker configuration |
| `package.json` | Scripts and dependencies |
| `LICENSE` | MIT open-source license |

## Features

The parser discovers BBC Sport article, live, and scorecard links; extracts thumbnails and metadata; retrieves full article text when available; supports football and cricket as separate categories; provides a browser-friendly root page; and adds a small in-memory cache. If a single item fails, the API keeps the remaining results and reports an item-level `scrapeError` where appropriate.

## Open-source notes

This project is provided for educational and personal use. BBC-hosted article text, images, trademarks, and other content remain subject to their respective rights and terms. For a public production service, consider returning article links and short metadata only unless you have permission to redistribute full content and images. Keep request rates low and avoid bypassing access controls.

## Support the project

If this project helps you, you can follow the **[WhatsApp Channel](https://whatsapp.com/channel/0029Vak4dFAHQbSBzyxlGG13)** for updates. You can also fork the repository, improve the parser, and submit a pull request.

> If you use this project publicly, please keep the attribution `creator: "whiteshadow"` or clearly identify your own fork.

## References

1. [BBC Sport](https://www.bbc.com/sport)
2. [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
3. [Wrangler deployment documentation](https://developers.cloudflare.com/workers/wrangler/)
4. [Node.js](https://nodejs.org/)
