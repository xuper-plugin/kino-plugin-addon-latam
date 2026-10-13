// @ts-check
/// <reference path="./kino.d.ts" />
// Kino plugin: Addon Latam -- movies and series in Latin American Spanish.
// Talks to one backend (addonlatam.duckdns.org, the Addon Latam Stremio addon, reached through its personal address:
// the code in its path is sealed in the manifest (`secrets.addonCode`), never written in this file). Read it top to bottom:
//   1. constants   2. texts   3. cache   4. addon client   5. items   6. search   7. home, browse, section, categories
//   8. episodes and details   9. resolve   10. settings
// Declared host: addonlatam.duckdns.org (kino.fetch). The video is on other servers (its own redirects, CDNs): that is the
// manifest's `streamHosts: "any"`, which the person approves at install.

const HOST = "addonlatam.duckdns.org";
// Kino keeps at most 60 items in a row; a browse page (the addon pages 60 movies or 80 series) up to 100.
const ROW_MAX = 60;
const MAX_SKIP = 600;
// A list that answers slower than this is left out, never holding the others back.
const LIST_TIMEOUT_MS = 8000;
const RESOLVE_TIMEOUT_MS = 9000;

// `genre` is Kino's closed vocabulary (peliculas, series, ...): it files the row under Categorías and in the filters.
const TYPES = [
  { type: "movie", label: "Películas", labelEn: "Movies", genre: "peliculas" },
  { type: "series", label: "Series", labelEn: "Series", genre: "series" },
];

// ---- 1. texts -------------------------------------------------------------------------------------------------

// Every text the person reads, in Spanish and English: Kino does not translate a plugin's texts. kino.lang is the person's
// language ("es-CO"); anything that is not Spanish reads English.
const TEXTS = {
  es: {
    needUrl: "No se pudo abrir el código sellado del plugin: instálalo desde su rama principal, sin @rama.",
    unavailable: "Addon Latam no responde ahora. Intenta de nuevo en un rato.",
    noStreams: "Este título no tiene video disponible por ahora. Prueba otro o vuelve más tarde.",
    noEpisodes: "Este título no trae lista de episodios.",
    rowNew: "Estrenos — {name}",
    sectionHero: "Estrenos al día.",
    copy: "Opción {n}",
    cacheStatus: "Caché: {n} entradas, {kb} KB", cacheCleared: "Listo: se vació la caché",
    healthOk: "responde", healthFail: "falla", healthNone: "sin datos",
    probeOk: "Listo: el servicio responde", probeFail: "El servicio no responde ahora",
    tileMovies: "Estrenos de cine", tileSeries: "Estrenos de series",
    langLatino: "Latino", langCastellano: "Castellano", langSub: "Subtitulado", langEn: "Inglés",
  },
  en: {
    needUrl: "The plugin's sealed code could not be opened: install it from its default branch, without a @branch.",
    unavailable: "Addon Latam isn't responding right now. Try again in a while.",
    noStreams: "This title has no video available right now. Try another or come back later.",
    noEpisodes: "This title has no episode list.",
    rowNew: "New — {name}",
    sectionHero: "Fresh releases.",
    copy: "Option {n}",
    cacheStatus: "Cache: {n} entries, {kb} KB", cacheCleared: "Done: the cache is empty",
    healthOk: "responding", healthFail: "failing", healthNone: "no data",
    probeOk: "Done: the service responds", probeFail: "The service is not responding right now",
    tileMovies: "New in cinemas", tileSeries: "New series",
    langLatino: "Latin Spanish", langCastellano: "Castilian", langSub: "Subtitled", langEn: "English",
  },
};

function isSpanish() {
  return String(kino.lang || "").toLowerCase().startsWith("es");
}

function t(key, vars) {
  const template = TEXTS[isSpanish() ? "es" : "en"][key] || TEXTS.es[key] || key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] != null ? vars[k] : "")) : template;
}

function typeLabel(x) {
  return isSpanish() ? x.label : x.labelEn;
}

// ---- 2. cache -------------------------------------------------------------------------------------------------

// kino.storage keeps 256 KB in all. Every entry is `{ at, v }` and lives HARD_TTL_MS; it is "fresh" for the window the
// caller gives. A fresh entry answers without the network; an expired-but-kept one is the fallback when the backend fails
// (a list that is a little old beats an empty screen).
const CACHE_PREFIX = "c1:";
const HARD_TTL_MS = 24 * 60 * 60 * 1000;
const ENTRY_MAX_CHARS = 48 * 1024;
const FRESH_NEW_MS = 15 * 60 * 1000;
const FRESH_META_MS = 60 * 60 * 1000;
const FRESH_ART_MS = 12 * 60 * 60 * 1000;

function cacheKeys() {
  return kino.storage.keys().filter((k) => k.startsWith(CACHE_PREFIX));
}

function cacheRead(key) {
  const raw = kino.storage.get(CACHE_PREFIX + key);
  if (!raw) return null;
  try {
    const e = JSON.parse(raw);
    return e && typeof e.at === "number" ? e : null;
  } catch {
    kino.storage.remove(CACHE_PREFIX + key);
    return null;
  }
}

function evictOldest() {
  let victim = null;
  let oldest = Infinity;
  for (const k of cacheKeys()) {
    let at = 0;
    try {
      at = JSON.parse(kino.storage.get(k) || "{}").at || 0;
    } catch {
      // unreadable: the first to go
    }
    if (at < oldest) {
      oldest = at;
      victim = k;
    }
  }
  if (!victim) return false;
  kino.storage.remove(victim);
  return true;
}

// A cache never fails the call it serves: whatever storage refuses is simply not cached.
function cacheWrite(key, v) {
  const raw = JSON.stringify({ at: Date.now(), v });
  if (raw.length > ENTRY_MAX_CHARS) return;
  for (let tries = 0; tries < 20; tries++) {
    try {
      kino.storage.set(CACHE_PREFIX + key, raw, { ttlMs: HARD_TTL_MS });
      return;
    } catch (e) {
      if (!e || e.code !== "too_large" || !evictOldest()) return;
    }
  }
}

// The value for `key`: fresh from the cache, else from `load()` (and cached), else (load failed) the stale copy.
async function cached(key, freshMs, load) {
  const hit = cacheRead(key);
  if (hit && Date.now() - hit.at < freshMs) return hit.v;
  try {
    const v = await load();
    cacheWrite(key, v);
    return v;
  } catch (e) {
    if (hit) {
      kino.log("serving stale " + key + ": " + (e && e.message));
      return hit.v;
    }
    throw e;
  }
}

// ---- 3. addon client ------------------------------------------------------------------------------------------

const enc = encodeURIComponent;

// The addon's address: its code is sealed in the manifest, so the marker stands in for it until kino.fetch sends the request
// (the code never reaches this file, a log or an error).
function base() {
  try {
    return `https://${HOST}/${kino.secret("addonCode")}`;
  } catch {
    // A seal only opens when the plugin is installed from its default branch, without @branch.
    throw kino.error("auth_required", "the sealed addon code is not available", { userMessage: t("needUrl") });
  }
}

async function getJson(path, timeoutMs) {
  let r;
  try {
    r = await kino.fetch(base() + path, { timeoutMs: timeoutMs || 15000 });
  } catch (e) {
    recordHealth(false);
    throw e;
  }
  if (!r.ok) {
    recordHealth(false);
    throw kino.error("unavailable", "Addon Latam answered " + r.status, { userMessage: t("unavailable") });
  }
  try {
    const body = await r.json();
    recordHealth(true);
    return body;
  } catch {
    recordHealth(false);
    throw kino.error("unavailable", "Addon Latam answered something that is not JSON", { userMessage: t("unavailable") });
  }
}

function newUrl(type, skip) {
  return `/catalog/${type}/addonlatam-new-releases-${type}${skip > 0 ? "/skip=" + skip : ""}.json`;
}

function searchUrl(type, query) {
  return `/catalog/${type}/addonlatam-search-${type}/search=${enc(query)}.json`;
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return out;
}

// ---- 3b. service health ---------------------------------------------------------------------------------------

// kino.storage key `health` keeps { ok, fails, at } (fails = failed requests in a row). Three in a row are reported once
// (the third only) to the author's board; an ok answer resets the count.
const HEALTH_KEY = "health";
const DOWN_AFTER = 3;

function readHealth() {
  try {
    const h = JSON.parse(kino.storage.get(HEALTH_KEY) || "{}");
    return h && typeof h === "object" && !Array.isArray(h) ? h : {};
  } catch {
    return {};
  }
}

function recordHealth(ok) {
  try {
    const prev = readHealth();
    const fails = ok ? 0 : (Number.isFinite(prev.fails) ? prev.fails : 0) + 1;
    kino.storage.set(HEALTH_KEY, JSON.stringify({ ok, fails, at: Date.now() }));
    if (fails === DOWN_AFTER) kino.log.report("latam:down", "addon");
  } catch {
    // a full storage: the next request records again
  }
}

// ---- 4. items -------------------------------------------------------------------------------------------------

const MAX_ID = 128;

// A Kino item id (^[A-Za-z0-9._~-]{1,128}$, stable: the library keys the title by it) from the addon's id (an IMDb "tt…"
// for almost everything, a slug such as "matrix_uhd" for its own collections).
function kinoId(addonId) {
  const clean = String(addonId || "").replace(/:/g, "~").replace(/[^A-Za-z0-9._~-]/g, "-") || "unknown";
  if (clean.length <= MAX_ID) return clean;
  return clean.slice(0, MAX_ID - 9) + "-" + kino.crypto.hash("sha1", String(addonId)).slice(0, 8);
}

const IMDB = /^tt\d{5,10}$/;

// The addon's titles carry the year in the name ("Matrix - 1973", "Matrix : Generation (2023)") and, for older ones, a
// WRONG year: the title is kept clean and the year is left to the title's page.
function cleanTitle(name) {
  return String(name || "")
    .replace(/\s*[-–]\s*(?:19|20)\d{2}\s*$/, "")
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/, "")
    .trim()
    .slice(0, 200);
}

// A film's ref is "m:<id>" (Kino sends a movie's ref straight to resolve and to details, never to episodes); a series' is
// "i:<id>" (it goes to episodes); an episode's is "e:<id>:<season>:<number>".
function toItem(m, type) {
  const movie = type === "movie";
  const item = { id: kinoId(m.id), ref: (movie ? "m:" : "i:") + m.id, title: cleanTitle(m.name), kind: movie ? "movie" : "series" };
  if (m.poster) item.poster = String(m.poster);
  return item;
}

function itemsOf(body, type) {
  return body && Array.isArray(body.metas) ? body.metas.filter((m) => m && m.id && m.name).map((m) => toItem(m, type)) : [];
}

// ---- 5. search ------------------------------------------------------------------------------------------------

// Movies and series at once (or only the kind Kino asked for); a list that fails is left out. Interleaved, de-duplicated,
// then ORDERED (never filtered) by how much each title resembles what was typed.
export async function search(query) {
  const q = kino.rank.shortQuery(String(query.q || "").trim());
  if (!q) return [];
  const wanted = TYPES.filter((x) => query.type !== "movie" && query.type !== "series" ? true : x.type === query.type);
  const titles = [query.q, query.originalTitle].concat(Array.isArray(query.altTitles) ? query.altTitles : []).filter((x) => typeof x === "string" && x.trim());
  async function run(text) {
    const lists = await mapLimit(wanted, 2, async (x) => {
      try {
        return itemsOf(await getJson(searchUrl(x.type, text), LIST_TIMEOUT_MS), x.type);
      } catch (e) {
        kino.log("search " + x.type + " failed: " + (e && e.message));
        return [];
      }
    });
    const merged = [];
    const longest = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) merged.push(l[i]);
    const seen = new Set();
    return merged.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  }
  let found = await run(q);
  // The typed (or TMDB's) title may not be the one the catalog uses: one more round with the first other title.
  if (!found.length) {
    const other = titles.map((x) => kino.rank.shortQuery(x.trim())).find((x) => x && x.toLowerCase() !== q.toLowerCase());
    if (other) found = await run(other);
  }
  return kino.rank.sortBySimilarity(found, titles);
}

// ---- 6. home, browse, section and categories ------------------------------------------------------------------

async function newItems(x) {
  return cached("new:" + x.type, FRESH_NEW_MS, async () => itemsOf(await getJson(newUrl(x.type, 0), LIST_TIMEOUT_MS), x.type));
}

async function newRow(x) {
  try {
    const items = await newItems(x);
    return items.length ? { id: "new-" + x.type, title: t("rowNew", { name: typeLabel(x) }), ref: "n:" + x.type, items: items.slice(0, ROW_MAX), genre: x.genre } : null;
  } catch (e) {
    kino.log("new " + x.type + " failed: " + (e && e.message));
    return null;
  }
}

export async function home() {
  if (kino.config.get("homeRows") === false) return [];
  return (await mapLimit(TYPES, 2, newRow)).filter(Boolean);
}

// A kind's new releases, paged by the addon's `skip`. The first page is cached; later ones are asked for as the person scrolls.
export async function browse(ref, cursor) {
  const m = /^n:(movie|series)$/.exec(String(ref || ""));
  if (!m) throw kino.error("not_found", "unknown browse ref: " + String(ref).slice(0, 60));
  const type = m[1];
  const skip = Math.max(0, parseInt(cursor || "0", 10) || 0);
  const items = skip === 0 ? await newItems({ type }) : itemsOf(await getJson(newUrl(type, skip), 15000), type);
  // `skip` counts the items already read, whatever size the addon's pages have.
  return items.length && skip + items.length < MAX_SKIP ? { items: items.slice(0, 100), next: String(skip + items.length) } : { items: items.slice(0, 100) };
}

// The plugin's own section (a chip on the phone's Inicio, an entry in the TV's sidebar): one tab per kind.
export async function section({ tab }) {
  const tabs = TYPES.map((x) => ({ id: x.type, label: typeLabel(x) }));
  const chosen = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  const row = await newRow(TYPES.find((x) => x.type === chosen));
  const answer = { tabs, tab: chosen, rows: row ? [row] : [] };
  if (row) {
    // Today's pick: the same all day, a different one tomorrow.
    const pick = row.items[Math.floor(Date.now() / 86400000) % row.items.length];
    answer.hero = { title: pick.title, text: t("sectionHero") };
    if (pick.poster) answer.hero.image = pick.poster;
  }
  return answer;
}

// Two tiles, one per kind. The art of each is its first title's poster, cached 12 h.
export async function categories() {
  return mapLimit(TYPES, 2, async (x) => {
    let art = "";
    try {
      art = await cached("art:" + x.type, FRESH_ART_MS, async () => {
        const first = (await newItems(x))[0];
        return first && first.poster ? first.poster : "";
      });
    } catch (e) {
      kino.log("art " + x.type + " failed: " + (e && e.message));
    }
    const tile = { id: x.type, title: t(x.type === "movie" ? "tileMovies" : "tileSeries"), ref: "n:" + x.type };
    if (art) tile.art = art;
    return tile;
  });
}

// ---- 7. episodes and details ----------------------------------------------------------------------------------

function idOf(ref, prefix) {
  const s = String(ref || "");
  return s.startsWith(prefix) && s.length > prefix.length ? s.slice(prefix.length) : null;
}

// What Kino knows about a title (its own TMDB lookup, in the person's language). The addon's `meta` answers nothing, so
// episodes and the info page both come from here; only an IMDb id can be asked.
async function metaOf(type, id) {
  if (!IMDB.test(id) || typeof kino.meta !== "function") return null;
  return cached(`meta:${type}:${id}`, FRESH_META_MS, async () => {
    const m = await kino.meta({ type, ids: { imdb: id }, lang: kino.lang });
    if (!m) throw kino.error("not_found", "Kino knows nothing about " + id);
    return {
      title: m.title || "",
      poster: m.poster || "",
      backdrop: m.backdrop || "",
      overview: String(m.overview || "").slice(0, 2000),
      genres: Array.isArray(m.genres) ? m.genres.slice(0, 5) : [],
      year: m.year || "",
      runtimeMinutes: m.runtimeMinutes || 0,
      // [season, number, title, overview, still, air date]
      episodes: (Array.isArray(m.episodes) ? m.episodes : []).map((e) => [
        Math.max(0, parseInt(e.season, 10) || 0),
        Math.max(1, parseInt(e.number, 10) || 1),
        String(e.title || "").slice(0, 120),
        String(e.overview || "").slice(0, 300),
        e.still || "",
        String(e.airDate || "").slice(0, 10),
      ]),
    };
  });
}

function infoOf(meta) {
  const info = {};
  if (meta.title) info.title = meta.title;
  if (meta.poster) info.poster = meta.poster;
  if (meta.backdrop) info.backdrop = meta.backdrop;
  if (meta.overview) info.overview = meta.overview;
  if (meta.genres && meta.genres.length) info.genres = meta.genres;
  if (meta.year) info.year = meta.year;
  return info;
}

// Seasons, then numbers, ascending; specials (season 0) and episodes that have not aired yet are left out (the addon has
// nothing to play for them).
export async function episodes(ref) {
  const id = idOf(ref, "i:");
  if (!id) throw kino.error("not_found", "not a series ref: " + String(ref).slice(0, 80));
  const meta = await metaOf("series", id);
  if (!meta || !meta.episodes.length) throw kino.error("not_found", "no episode list for " + id.slice(0, 80), { userMessage: t("noEpisodes") });
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const eps = [];
  for (const [season, number, title, overview, still, date] of meta.episodes.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (season < 1 || (/^\d{4}-\d{2}-\d{2}$/.test(date) && date > today)) continue;
    const key = season + ":" + number;
    if (seen.has(key)) continue;
    seen.add(key);
    const ep = { season, number, ref: `e:${id}:${season}:${number}` };
    if (title) ep.title = title;
    if (overview) ep.overview = overview;
    if (still) ep.still = still;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) ep.airDate = date;
    eps.push(ep);
  }
  if (!eps.length) throw kino.error("not_found", "no aired episodes for " + id.slice(0, 80), { userMessage: t("noEpisodes") });
  return { series: infoOf(meta), episodes: eps };
}

// A title's page (apiVersion 8): the same cached meta. A title with no IMDb id (the addon's own collections) has none:
// null, and Kino shows the card's own data.
export async function details(ref) {
  const movie = idOf(ref, "m:");
  const id = movie || idOf(ref, "i:");
  if (!id) return null;
  try {
    const meta = await metaOf(movie ? "movie" : "series", id);
    if (!meta) return null;
    const info = infoOf(meta);
    if (movie && meta.runtimeMinutes) info.runtimeMinutes = meta.runtimeMinutes;
    return info;
  } catch (e) {
    kino.log("details failed: " + (e && e.message));
    return null;
  }
}

// ---- 8. resolve -----------------------------------------------------------------------------------------------

const LANGS = [
  { re: /latino/i, key: "langLatino", rank: 0 },
  { re: /castellano|espa[ñn]a|\bcast\b/i, key: "langCastellano", rank: 1 },
  { re: /subt|\bsub\b|\bvose\b/i, key: "langSub", rank: 2 },
  { re: /ingl[eé]s|english|\bvo\b|original/i, key: "langEn", rank: 3 },
];

// The addon writes "Matrix\nOpción 2 • 4k • Latino" (the order of the parts changes): the option number, the quality and
// the language are read from wherever they are.
function describe(s) {
  const text = String(s.title || s.description || "") + " " + String(s.name || "");
  const n = /opci[oó]n\s*(\d{1,2})/i.exec(text);
  const lang = LANGS.find((l) => l.re.test(text));
  const quality = /4k|2160/i.test(text) ? 2160 : /1080/.test(text) ? 1080 : /720/.test(text) ? 720 : /480/.test(text) ? 480 : 0;
  return { n: n ? parseInt(n[1], 10) : 0, lang, quality };
}

function qualityName(q) {
  return q === 2160 ? "4K" : q ? q + "p" : "";
}

// A copy is told apart across plays by a key: the addon's own `/redirect/` links (every one on the same host) by their
// option number, anything else (a CDN link the addon passes through) by its host, so one dead CDN is one entry.
function copyKey(url, ref, n, index) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // an unparsable url is judged by its position
  }
  return host === HOST ? `o:${ref}|${n || index + 1}` : `h:${host || index}`;
}

// Measured on three titles: the addon's own redirect links reached a server and streamed at 5-10 Mbit/s, while the direct
// third-party links it also lists were dead (404, no connection) in every one. Tier 0 plays first, within a language.
function tierOf(url) {
  try {
    return new URL(url).hostname.toLowerCase() === HOST ? 0 : 1;
  } catch {
    return 1;
  }
}

function toStream(s, index, ref) {
  const d = describe(s);
  const parts = [t("copy", { n: d.n || index + 1 })];
  if (d.quality) parts.push(qualityName(d.quality));
  if (d.lang) parts.push(t(d.lang.key));
  const url = String(s.url);
  const stream = { url, label: parts.join(" · ").slice(0, 48) };
  return { stream, quality: d.quality, langRank: d.lang ? d.lang.rank : 4, index, tier: tierOf(url), key: copyKey(url, ref, d.n, index) };
}

// Quality preference: "max" goes from the highest down; "1080" and "720" put the best copy that fits first, then the
// lower ones, and the heavier ones last. An unlabelled copy counts as the cap (unknown, not worse).
function qualityRank(q, pref) {
  if (pref === "max") return -q;
  const cap = pref === "720" ? 720 : 1080;
  const v = q || cap;
  return v <= cap ? cap - v : 100000 + (v - cap);
}

async function streamsOf(path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const body = await getJson(path, RESOLVE_TIMEOUT_MS);
    const list = Array.isArray(body.streams) ? body.streams.filter((s) => s && typeof s.url === "string" && /^https?:\/\//.test(s.url)) : [];
    if (list.length) return list;
    if (attempt < 1) await kino.sleep(800);
  }
  return [];
}

// ---- 8b. what failed before ---------------------------------------------------------------------------------------

// Kino only tells a plugin that a copy failed when the origin REFUSED it (`options.retry`: 401, 403, 409); a dead link
// (404, no connection) just moves the player on to the next alternative without a word. So a second resolve of the same
// title soon after the first is read as "that copy did not work" too. The copy that was served first is then remembered as
// bad for a while and goes last, for this title and, when it is a CDN host, for every title on that host.
const SERVED_PREFIX = "served:";
const BAD_KEY = "bad";
const REOPEN_WINDOW_MS = 2 * 60 * 1000;
const BAD_FOR_MS = 10 * 60 * 1000;
const BAD_MAX = 40;

function readBad() {
  try {
    const raw = JSON.parse(kino.storage.get(BAD_KEY) || "{}");
    const now = Date.now();
    const out = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) for (const [k, until] of Object.entries(raw)) if (Number(until) > now) out[k] = Number(until);
    return out;
  } catch {
    return {};
  }
}

function writeBad(bad) {
  try {
    const entries = Object.entries(bad).sort((a, b) => b[1] - a[1]).slice(0, BAD_MAX);
    kino.storage.set(BAD_KEY, JSON.stringify(Object.fromEntries(entries)), { ttlMs: BAD_FOR_MS });
  } catch {
    // a full storage: the order just is not learned this time
  }
}

// The person's language first (Latin American Spanish before everything), then copies that worked before and the addon's
// own links, then the quality they prefer; the rest stay in the Server menu. The 30 minutes only matter when a playback
// fails: Kino then asks for a fresh link.
export async function resolve(ref, options) {
  const movie = idOf(ref, "m:");
  let path;
  if (movie) {
    path = `/stream/movie/${enc(movie)}.json`;
  } else {
    const m = /^e:(.+):(\d{1,3}):(\d{1,5})$/.exec(String(ref || ""));
    if (!m) throw kino.error("not_found", "not a playable ref: " + String(ref).slice(0, 80));
    path = `/stream/series/${enc(`${m[1]}:${m[2]}:${m[3]}`)}.json`;
  }
  const raw = await streamsOf(path);
  const seen = new Set();
  const pref = String(kino.config.get("quality") || "1080");
  const bad = readBad();
  const servedKey = SERVED_PREFIX + String(ref).slice(0, 120);
  let prev = null;
  try {
    prev = JSON.parse(kino.storage.get(servedKey) || "null");
  } catch {
    prev = null;
  }
  const now = Date.now();
  const reopened = (options && options.retry) || (prev && typeof prev.t === "number" && now - prev.t < REOPEN_WINDOW_MS);
  if (reopened && prev && prev.key) {
    bad[prev.key] = now + BAD_FOR_MS;
    writeBad(bad);
  }
  const pool = raw
    .map((s, i) => toStream(s, i, ref))
    .filter((x) => (seen.has(x.stream.url) ? false : (seen.add(x.stream.url), true)))
    .sort(
      (a, b) =>
        a.langRank - b.langRank ||
        (bad[a.key] ? 1 : 0) - (bad[b.key] ? 1 : 0) ||
        a.tier - b.tier ||
        qualityRank(a.quality, pref) - qualityRank(b.quality, pref) ||
        a.index - b.index,
    );
  if (!pool.length) throw kino.error("not_found", "no streams for " + String(ref).slice(0, 80), { userMessage: t("noStreams") });
  const [first, ...rest] = pool;
  try {
    kino.storage.set(servedKey, JSON.stringify({ t: now, key: first.key }), { ttlMs: BAD_FOR_MS });
  } catch {
    // not remembered: the next play just starts from the same order
  }
  const main = { ...first.stream, expiresInSeconds: 1800 };
  const alternatives = rest.slice(0, 8).map((x) => x.stream);
  if (alternatives.length) main.alternatives = alternatives;
  return main;
}

// ---- 9. settings ----------------------------------------------------------------------------------------------

// One line for the form's status (at most 200 characters, the status line's cap).
export async function settingsStatus() {
  const keys = cacheKeys();
  let chars = 0;
  for (const k of keys) chars += k.length + (kino.storage.get(k) || "").length;
  const h = readHealth();
  const state = !h || h.ok === undefined ? "healthNone" : h.ok ? "healthOk" : "healthFail";
  return { cache: t("cacheStatus", { n: keys.length, kb: Math.ceil(chars / 1024) }), health: t(state) };
}

export async function action(key) {
  if (key === "clearCache") {
    for (const k of cacheKeys()) kino.storage.remove(k);
    return { message: t("cacheCleared") };
  }
  if (key === "probe") {
    try {
      await getJson(newUrl("movie", 0), LIST_TIMEOUT_MS);
      return { message: t("probeOk") };
    } catch (e) {
      if (e && e.code === "auth_required") throw e;
      return { message: t("probeFail") };
    }
  }
  throw kino.error("not_found", "unknown action " + String(key).slice(0, 40));
}
