import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BBC_ORIGIN = 'https://www.bbc.com';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 60 * 1000);
const cache = new Map();
const CREATOR = process.env.CREATOR || 'whiteshadow';

app.use(cors());
app.use(express.json());

function absoluteUrl(value) {
  if (!value) return null;
  try {
    return new URL(value, BBC_ORIGIN).href;
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function firstNonEmpty(...values) {
  return values.map(cleanText).find(Boolean) || null;
}

function imageUrlFromElement($, element) {
  const image = $(element).find('img').first();
  if (!image.length) return null;
  const srcset = image.attr('srcset');
  if (srcset) {
    const candidates = srcset.split(',').map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
    if (candidates.length) return absoluteUrl(candidates[candidates.length - 1]);
  }
  return absoluteUrl(image.attr('src') || image.attr('data-src'));
}

function parseJsonLd($) {
  const records = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const value = JSON.parse($(node).contents().text());
      const items = Array.isArray(value) ? value : [value];
      for (const item of items) {
        if (item && typeof item === 'object') records.push(item);
      }
    } catch {
      // Some pages contain non-JSON scripts with this MIME type; ignore them.
    }
  });
  return records;
}

function extractArticleBody($) {
  const jsonLd = parseJsonLd($).find((item) => item.articleBody);
  if (jsonLd?.articleBody) return cleanText(jsonLd.articleBody);

  const selectors = [
    '[data-component="text-block"]',
    '[data-component="paragraph"]',
    'main article p',
    'main p'
  ];
  for (const selector of selectors) {
    const paragraphs = $(selector).map((_, el) => cleanText($(el).text())).get()
      .filter((text) => text.length > 25);
    if (paragraphs.length >= 2) return paragraphs.join('\n\n');
  }
  return null;
}

function extractArticleMetadata($, url) {
  const jsonLd = parseJsonLd($).find((item) => item['@type'] === 'NewsArticle' || item['@type'] === 'Article');
  const meta = (name) => $(`meta[name="${name}"], meta[property="${name}"]`).attr('content');
  const imageFromLd = jsonLd?.image?.url || (Array.isArray(jsonLd?.image) ? jsonLd.image[0] : null);
  return {
    title: firstNonEmpty(jsonLd?.headline, meta('og:title'), $('h1').first().text()),
    description: firstNonEmpty(jsonLd?.description, meta('description'), meta('og:description')),
    author: firstNonEmpty(jsonLd?.author?.name, Array.isArray(jsonLd?.author) ? jsonLd.author[0]?.name : null),
    publishedAt: jsonLd?.datePublished || meta('article:published_time') || null,
    updatedAt: jsonLd?.dateModified || null,
    thumbnail: absoluteUrl(imageFromLd) || absoluteUrl(meta('og:image')) || imageUrlFromElement($, 'main'),
    url
  };
}

function isContentLink(href) {
  return /^\/sport\/[^/]+\/(articles|live|scorecard)\//.test(href || '');
}

function parseListing(html, category, limit) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];
  $('a[href]').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (!isContentLink(href)) return;
    const url = absoluteUrl(href);
    if (!url || seen.has(url)) return;
    const title = cleanText($(anchor).text());
    if (!title || title.length < 8) return;
    seen.add(url);
    let card = $(anchor);
    for (let depth = 0; depth < 10 && card.length; depth += 1) {
      if (card.find('img').length) break;
      card = card.parent();
    }
    const cardText = cleanText(card.text());
    const image = imageUrlFromElement($, card) || absoluteUrl($(anchor).find('img').attr('src'));
    const summary = cardText.replace(title, '').replace(/Attribution\s+[^\d]+/i, '').replace(/Posted\s+.+$/i, '').trim() || null;
    items.push({
      id: url.split('/').pop(),
      title,
      summary,
      category,
      url,
      thumbnail: image,
      publishedAt: null,
      content: null,
      isLive: /\/live\//.test(url)
    });
  });
  return items.slice(0, limit);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': process.env.USER_AGENT || 'bbc-sport-news-api/1.0 (+respectful low-rate scraping)',
      accept: 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) throw new Error(`BBC returned HTTP ${response.status} for ${url}`);
  return response.text();
}

async function withCache(key, loader) {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CACHE_TTL_MS) return existing.value;
  const value = await loader();
  cache.set(key, { createdAt: Date.now(), value });
  return value;
}

async function scrapeNews(category, limit = 10, includeContent = true) {
  const listingUrl = `${BBC_ORIGIN}/sport/${category}`;
  const basicItems = await withCache(`listing:${category}:${limit}`, async () => {
    const html = await fetchHtml(listingUrl);
    return parseListing(html, category, limit);
  });
  if (!includeContent) return basicItems;

  return Promise.all(basicItems.map((item) => withCache(`article:${item.url}`, async () => {
    try {
      const html = await fetchHtml(item.url);
      const $ = cheerio.load(html);
      const metadata = extractArticleMetadata($, item.url);
      return {
        ...item,
        ...metadata,
        creator: CREATOR,
        category,
        content: extractArticleBody($)
      };
    } catch (error) {
      return { ...item, scrapeError: error.message };
    }
  })));
}

function parseLimit(value) {
  const number = Number(value || 10);
  return Number.isFinite(number) ? Math.min(Math.max(Math.trunc(number), 1), 30) : 10;
}

async function newsHandler(req, res) {
  const category = req.params.category || 'sport';
  if (!['sport', 'football', 'cricket'].includes(category)) {
    return res.status(400).json({ error: 'category must be sport, football, or cricket' });
  }
  try {
    const limit = parseLimit(req.query.limit);
    const includeContent = req.query.full !== 'false';
    const data = await scrapeNews(category, limit, includeContent);
    res.json({
      success: true,
      creator: CREATOR,
      source: `${BBC_ORIGIN}/sport/${category}`,
      category,
      fetchedAt: new Date().toISOString(),
      count: data.length,
      data
    });
  } catch (error) {
    res.status(502).json({ success: false, error: error.message });
  }
}

app.get('/health', (_, res) => res.json({ ok: true, service: 'bbc-sport-news-api' }));
app.get('/api/news', newsHandler);
app.get('/api/news/:category', newsHandler);

app.listen(PORT, () => {
  console.log(`BBC Sport News API running at http://localhost:${PORT}`);
});

export { app, parseListing, extractArticleBody, extractArticleMetadata };
