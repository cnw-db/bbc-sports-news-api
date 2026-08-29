import * as cheerio from 'cheerio';

const BBC_ORIGIN = 'https://www.bbc.com';
const CREATOR = 'whiteshadow';
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const absoluteUrl = (value) => {
  if (!value) return null;
  try { return new URL(value, BBC_ORIGIN).href; } catch { return null; }
};
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function imageUrl($, root) {
  const image = $(root).find('img').first();
  const srcset = image.attr('srcset');
  if (srcset) {
    const values = srcset.split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean);
    if (values.length) return absoluteUrl(values.at(-1));
  }
  return absoluteUrl(image.attr('src') || image.attr('data-src'));
}

function jsonLd($) {
  const records = [];
  $('script[type="application/ld+json"]').each((_, node) => {
    try {
      const value = JSON.parse($(node).contents().text());
      records.push(...(Array.isArray(value) ? value : [value]));
    } catch {}
  });
  return records.filter(Boolean);
}

function articleData(html, url, category, fallback) {
  const $ = cheerio.load(html);
  const ld = jsonLd($).find((x) => x.articleBody || x['@type'] === 'NewsArticle' || x['@type'] === 'Article') || {};
  const meta = (name) => $(`meta[name="${name}"], meta[property="${name}"]`).attr('content');
  const paragraphs = $('[data-component="text-block"], [data-component="paragraph"], main article p, main p')
    .map((_, el) => clean($(el).text())).get().filter((x) => x.length > 25);
  return {
    ...fallback,
    ...{
      title: clean(ld.headline || meta('og:title') || $('h1').first().text()) || fallback.title,
      description: clean(ld.description || meta('description') || meta('og:description')) || null,
      author: clean(ld.author?.name || (Array.isArray(ld.author) ? ld.author[0]?.name : '')) || null,
      publishedAt: ld.datePublished || meta('article:published_time') || null,
      updatedAt: ld.dateModified || null,
      thumbnail: absoluteUrl(ld.image?.url || (Array.isArray(ld.image) ? ld.image[0] : null)) || absoluteUrl(meta('og:image')) || imageUrl($, 'main') || fallback.thumbnail,
      content: clean(ld.articleBody) || (paragraphs.length ? paragraphs.join('\n\n') : null),
      creator: CREATOR,
      category,
      url
    }
  };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'user-agent': 'whiteshadow-bbc-sport-api/1.0', accept: 'text/html' } });
  if (!response.ok) throw new Error(`BBC returned HTTP ${response.status}`);
  return response.text();
}

async function cached(key, loader) {
  const old = cache.get(key);
  if (old && Date.now() - old.time < CACHE_TTL_MS) return old.value;
  const value = await loader();
  cache.set(key, { time: Date.now(), value });
  return value;
}

async function scrape(category, limit, full) {
  const items = await cached(`list:${category}:${limit}`, async () => {
    const $ = cheerio.load(await fetchText(`${BBC_ORIGIN}/sport/${category}`));
    const seen = new Set();
    const result = [];
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (!/^\/sport\/[^/]+\/(articles|live|scorecard)\//.test(href || '')) return;
      const url = absoluteUrl(href);
      const title = clean($(a).text());
      if (!url || !title || seen.has(url)) return;
      let card = $(a);
      for (let i = 0; i < 10 && card.length && !card.find('img').length; i++) card = card.parent();
      seen.add(url);
      result.push({ id: url.split('/').pop(), title, summary: clean(card.text().replace(title, '')) || null, category, url, thumbnail: imageUrl($, card), publishedAt: null, content: null, creator: CREATOR, isLive: url.includes('/live/') });
    });
    return result.slice(0, limit);
  });
  if (!full) return items;
  return Promise.all(items.map((item) => cached(`article:${item.url}`, async () => {
    try { return articleData(await fetchText(item.url), item.url, category, item); }
    catch (error) { return { ...item, scrapeError: error.message }; }
  })));
}

function limitOf(value) {
  const number = Number(value || 10);
  return Number.isFinite(number) ? Math.min(Math.max(Math.trunc(number), 1), 30) : 10;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'bbc-sport-news-api', creator: CREATOR });
    const match = url.pathname.match(/^\/api\/news(?:\/(sport|football|cricket))?\/?$/);
    if (!match) return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    const category = match[1] || 'sport';
    try {
      const full = url.searchParams.get('full') !== 'false';
      const data = await scrape(category, limitOf(url.searchParams.get('limit')), full);
      return Response.json({ success: true, creator: CREATOR, source: `${BBC_ORIGIN}/sport/${category}`, category, fetchedAt: new Date().toISOString(), count: data.length, data }, { headers: { 'cache-control': 'public, max-age=60' } });
    } catch (error) {
      return Response.json({ success: false, creator: CREATOR, error: error.message }, { status: 502 });
    }
  }
};
