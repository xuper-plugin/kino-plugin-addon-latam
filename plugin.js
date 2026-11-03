// src/browse/model.js
var TAB_IDS = ["inicio", "peliculas", "series"];
var MAX_SLIDES = 6;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  const poster = item.poster || item.logo;
  if (poster && HTTPS.test(poster)) out.poster = poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.adult === true) out.adult = true;
  return out;
}
function slidesOf(rows) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items) {
      if (out.length >= MAX_SLIDES) return out;
      if (item.adult === true || seen.has(item.id) || !item.backdrop || !HTTPS.test(item.backdrop)) continue;
      const text = typeof item.overview === "string" ? item.overview.trim() : "";
      if (text === "") continue;
      seen.add(item.id);
      out.push({
        id: item.id,
        ref: item.ref,
        kind: item.kind,
        title: item.title,
        image: item.backdrop,
        text: text.length <= MAX_SLIDE_TEXT ? text : `${text.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`
      });
    }
  }
  return out;
}
function railsOf(rows) {
  return rows.filter((r) => r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.ref ? { ref: r.ref } : {},
    items: r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf)
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), rails };
}
function imdbOfRef(ref) {
  const m = /^[mie]:(tt\d{5,10})(?::|$)/.exec(String(ref || ""));
  return m ? m[1] : "";
}
function recentOf(imdbIds, tabs, imdbOfTmdb = () => "") {
  if (imdbIds.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const id = imdbOfRef(card.ref) || (card.ids && card.ids.tmdb ? imdbOfTmdb(card.ids.tmdb) : "");
        if (id && !byKey.has(id)) byKey.set(id, card);
      }
    }
  }
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const id of imdbIds) {
    const card = byKey.get(id);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/browse/words.js
var WORDS = {
  tabHome: ["Inicio", "Home"],
  tabMovies: ["Pel\xEDculas", "Movies"],
  tabSeries: ["Series", "Series"],
  brWatch: ["Ver", "Watch"],
  brInfo: ["M\xE1s informaci\xF3n", "More info"],
  brRecent: ["Continuar viendo", "Continue watching"],
  brSearch: ["Buscar", "Search"],
  brSearchHint: ["Buscar en PelicuSeries", "Search PelicuSeries"],
  brSearchTitle: ["Buscar", "Search"],
  brSearchedBefore: ["Buscado recientemente", "Recently searched"],
  brNoResults: ["No encontramos nada con esas palabras.", "Nothing matched those words."],
  brSearchFailed: ["No se pudo buscar. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "The search failed. Check your connection and try again."],
  brFailed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  brRetry: ["Reintentar", "Retry"],
  brEmpty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  brBack: ["Atr\xE1s", "Back"],
  brClose: ["Cerrar", "Close"],
  brSettings: ["Configuraci\xF3n", "Settings"]
};
var both = (key) => ({ es: WORDS[key][0], en: WORDS[key][1] });
var KEYS = Object.keys(WORDS);

// src/browse/logo.js
var LOGO_ASPECT = "3.33:1";
var LOGO_DATA = "data:image/png;base64,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";

// src/browse/view.js
var TAB_KEYS = { inicio: "tabHome", peliculas: "tabMovies", series: "tabSeries" };
var POLL_MS = 1500;
var SEARCH_CAP = 60;
var twin = (key, field = "text", vars) => {
  const w = both(key, vars);
  return { [field]: w.es, [field + "En"]: w.en };
};
var logo = () => ({
  type: "Image",
  key: "logo",
  url: LOGO_DATA,
  aspect: LOGO_ASPECT,
  fit: "contain",
  h: 40,
  alt: "PelicuSeries",
  altEn: "PelicuSeries",
  fallback: { type: "Text", text: "PelicuSeries", textEn: "PelicuSeries", style: "h4" }
});
var tabBar = (active) => ({ type: "TabBar", key: "tabs", divider: false, value: active, onChanged: "tab", tabs: TAB_IDS.map((id) => ({ value: id, ...twin(TAB_KEYS[id], "label") })) });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var gridSkeleton = () => ({
  type: "Column",
  key: "gridSkeleton",
  gap: 12,
  children: [
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["compact"], key: `gc${r}`, children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `gc${r}-${i}`, flex: 1 })) })),
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["medium", "expanded"], key: `gw${r}`, children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `gw${r}-${i}`, flex: 1 })) }))
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var slideNode = (s) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  buttons: [
    {
      type: "ElevatedButton",
      key: "watch-" + s.id,
      ...twin("brWatch", "labelText"),
      icon: "play",
      onPressed: { go: { play: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } }
    },
    {
      type: "TextButton",
      key: "info-" + s.id,
      ...twin("brInfo", "labelText"),
      onPressed: { go: { title: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } }
    }
  ]
});
var hero = (slides) => slides.length === 1 ? slideNode(slides[0]) : {
  type: "PageView",
  key: "hero",
  autoPlayMs: 6e3,
  children: slides.map(slideNode)
};
var rail = (r, key, titleOverride, size = "medium") => ({
  type: "titleRail",
  key,
  ...titleOverride || { title: r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  size
});
function browseView({ tab, data, recent, pending, failed, device = "phone" }) {
  const tv = device === "tv";
  const gear = { type: "IconButton", key: "settingsButton", icon: "settings", ...twin("brSettings", "labelText"), ...twin("brSettings", "tooltip"), onPressed: { event: "go", arg: "settings" } };
  const active = TAB_IDS.includes(tab) ? tab : TAB_IDS[0];
  const body = [];
  if (data) {
    if (data.slides.length > 0) body.push(hero(data.slides));
    else if (pending) body.push(heroSkeleton());
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("brRecent", "title"), tv ? "small" : "medium"));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, tv ? "small" : "medium"));
    if (data.rails.length === 0) body.push({ type: "Text", ...twin("brEmpty", "text"), color: "muted" });
  } else if (failed) {
    body.push({
      type: "MaterialBanner",
      key: "loadFailed",
      role: "error",
      ...twin("brFailed"),
      action: { ...twin("brRetry", "label"), onTap: "retry" }
    });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      // One bar instead of two (Kino 0.9.81+; an older Kino draws its own bar above and this one under it): the close button where
      // Kino's was and the plugin's logo where its name was (its name when the logo cannot be drawn), with no line under it.
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "close", icon: "close", ...twin("brClose", "labelText"), ...twin("brClose", "tooltip"), onPressed: { go: { close: true } } },
      // On a TV the search is a button of the bar (a floating one is hard to reach with a remote); elsewhere it floats.
      actions: tv ? [{ type: "IconButton", key: "searchButton", icon: "search", ...twin("brSearch", "labelText"), ...twin("brSearch", "tooltip"), onPressed: "openSearch" }, gear] : [gear],
      title: tv ? { type: "Row", key: "titleRow", gap: 24, crossAxisAlignment: "center", children: [logo(), tabBar(active)] } : logo()
    },
    ...tv ? {} : { floatingActionButton: { type: "FloatingActionButton", key: "searchFab", icon: "search", ...twin("brSearch", "tooltip"), onPressed: "openSearch" } },
    // The tabs stay pinned under the bar; only the rows scroll.
    body: { type: "Column", key: "page", children: [
      // The tabs line up with the bar's buttons and the cards below (a wide window and the TV pad their content by 24).
      ...tv ? [] : [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(active)] }],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function settingsView() {
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin("brBack", "labelText"), ...twin("brBack", "tooltip"), onPressed: "back" },
      title: logo()
    },
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [{ type: "settings", key: "form" }] }] }
  };
}
function searchView({ query, status, items, history = [], device = "phone" }) {
  const tv = device === "tv";
  const searchForm = () => ({
    type: "Form",
    key: "searchForm",
    onSubmitted: "search",
    gap: 8,
    children: tv ? [{ type: "Row", key: "searchRow", gap: 16, crossAxisAlignment: "center", children: [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin("brSearchHint", "labelText"), maxLength: 100, autofocus: true, weight: 1 },
      { type: "ElevatedButton", key: "searchGo", ...twin("brSearch", "labelText"), icon: "search", submit: true }
    ] }] : [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin("brSearchHint", "labelText"), maxLength: 100, autofocus: true },
      { type: "ElevatedButton", key: "searchGo", ...twin("brSearch", "labelText"), icon: "search", submit: true }
    ]
  });
  const body = tv ? [] : [searchForm()];
  if (status === "fail") {
    body.push({ type: "MaterialBanner", key: "searchFailed", role: "error", ...twin("brSearchFailed"), action: { ...twin("brRetry", "label"), onTap: "sretry" } });
  } else if (status === "done" && items) {
    if (items.length === 0) body.push({ type: "Text", ...twin("brNoResults", "text"), color: "muted" });
    else body.push({ type: "titleGrid", key: "results", columns: { compact: 3, expanded: 6 }, items: items.slice(0, SEARCH_CAP) });
  } else if (status !== "idle") {
    body.push(gridSkeleton());
  } else if (history.length > 0) {
    body.push({ type: "Text", ...twin("brSearchedBefore", "text"), style: "h4" });
    body.push({ type: "titleGrid", key: "history", columns: { compact: 3, expanded: 6 }, items: history.slice(0, SEARCH_CAP) });
  }
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin("brBack", "labelText"), ...twin("brBack", "tooltip"), onPressed: "back" },
      ...tv ? { title: searchForm() } : twin("brSearchTitle", "title")
    },
    body: { type: "SingleChildScrollView", key: "search-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...status === "loading" ? { every: { ms: 1e3, event: "stick" } } : {}
  };
}

// src/browse/metaCache.js
var KEY = "meta2";
var MAX = 260;
var CALL_MS = 8e3;
var CONCURRENCY = 3;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, clock = { now: () => Date.now() } }) {
  const usable = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read()[id];
    if (!e) return {};
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.b && HTTPS2.test(e.b) && e.o ? { backdrop: e.b, overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const withId = k.tmdb && !(c.ids && c.ids.tmdb) ? { ...c, ids: { ...c.ids || {}, tmdb: k.tmdb } } : c;
      return k.backdrop && !withId.backdrop ? { ...withId, backdrop: k.backdrop } : withId;
    });
  }
  async function fill(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let asked2 = 0;
    let stop = false;
    const todo = cards.filter((c) => c && typeof c.id === "string" && !Object.hasOwn(b, c.id) && !(c.ids && c.ids.tmdb && c.noLogo));
    let next = 0;
    const worker = async () => {
      while (!stop && next < todo.length) {
        if (clock.now() + CALL_MS > end) return;
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: c.kind === "series" ? "series" : "movie", title: c.title, ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: a && typeof a.logo === "string" ? a.logo : "",
            b: a && typeof a.backdrop === "string" ? a.backdrop : "",
            o: a && typeof a.overview === "string" ? a.overview.slice(0, 160) : ""
          };
          asked2++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (asked2 > 0) write();
    return asked2;
  }
  return { known, asked, dress, fill, usable };
}

// src/browse/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 12 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var HIST_KEY = "searchHist1";
var HIST_MAX = 24;
var MAX_META_TICKS = 30;
function metaAsk(c) {
  const title = String(c.title).replace(/\s*[([][^)\]]*[)\]]/g, "").replace(/\s+/g, " ").trim() || String(c.title);
  const y = /\((19|20)\d{2}\)/.exec(String(c.title));
  return { id: c.id, title, kind: c.kind, ...y ? { year: parseInt(y[0].slice(1, 5), 10) } : {} };
}
var MAX_LOAD_TRIES = 3;
function makeBrowse({ kino: kino2, loadTab, searchTitles, imdbOfTmdb = () => "" }) {
  const meta = makeMetaCache({ kino: kino2 });
  const slidesFrom = (rails) => {
    const out = [];
    for (const r of rails) for (const c of r.items) {
      if (out.length >= 5) return out;
      const k = meta.known(c.id);
      if (!k.backdrop || c.adult === true || out.some((s) => s.id === c.id)) continue;
      out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: k.overview, ...k.logo ? { logo: k.logo } : {} });
    }
    return out;
  };
  const uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
  const enrich = (data) => data ? {
    slides: data.slides.length > 0 ? data.slides.map((s) => {
      const k = meta.known(s.id);
      return k.logo ? { ...s, logo: k.logo } : s;
    }) : slidesFrom(data.rails),
    rails: data.rails.map((r) => ({ ...r, items: uniform(meta.dress(r.items)) }))
  } : data;
  const metaTries = /* @__PURE__ */ new Map();
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[animes]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim2 = { slides: data.slides.slice(0, 4), rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text = JSON.stringify({ at: Date.now(), data: slim2 });
      if (text.length <= SNAP_MAX) {
        set(SNAP_PREFIX + tab, text, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  const remember = (tab) => set(TAB_KEY, tab);
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(imdb) {
    try {
      const key = String(imdb || "");
      if (!/^tt\d{5,10}$/.test(key)) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const slim = (c) => ({ id: c.id, ref: c.ref, title: c.title, kind: c.kind, ...c.poster ? { poster: c.poster } : {} });
  function readHistory() {
    try {
      const a = JSON.parse(get(HIST_KEY) || "[]");
      return Array.isArray(a) ? a.filter((c) => c && typeof c.id === "string" && typeof c.ref === "string" && typeof c.title === "string").slice(0, HIST_MAX) : [];
    } catch (_) {
      return [];
    }
  }
  function rememberFound(cards) {
    try {
      const fresh = cards.filter((c) => c.adult !== true).slice(0, 12).map(slim);
      const ids = new Set(fresh.map((c) => c.id));
      set(HIST_KEY, JSON.stringify([...fresh, ...readHistory().filter((c) => !ids.has(c.id))].slice(0, HIST_MAX)));
    } catch (_) {
    }
  }
  let found = null;
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab, device) {
    const order = [tab, ...TAB_IDS.filter((t2) => t2 !== tab)];
    return order.filter((t2, i) => (i === 0 || device !== "tv") && !(memo.get(t2) && memo.get(t2).whole));
  }
  function view(ctx) {
    const st = ctx.state && typeof ctx.state === "object" ? ctx.state : {};
    if (ctx.route && ctx.route.name === "settings") return settingsView();
    if (ctx.route && ctx.route.name === "search") {
      const query = typeof st.sq === "string" ? st.sq : "";
      const items = found && found.q === query ? found.items : null;
      const status = query === "" ? "idle" : st.sstate === "fail" ? "fail" : items ? "done" : "loading";
      return searchView({ query, status, items, history: query === "" ? readHistory() : [], device: ctx.device });
    }
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(ctx.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    return browseView({ tab, data, recent: uniform(meta.dress(recentOf(readKeys(), loaded, imdbOfTmdb))), pending, failed: !!(st.failed && st.failed[tab]), device: ctx.device });
  }
  async function load(tab) {
    const page = await loadTab(tab);
    const data = tabOf(page);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const loadTries = /* @__PURE__ */ new Map();
  function failLoad(tab, rest, failed) {
    const n = (loadTries.get(tab) || 0) + 1;
    loadTries.set(tab, n);
    if (n < MAX_LOAD_TRIES) rest.push(tab);
    else {
      failed[tab] = true;
      loadTries.delete(tab);
    }
  }
  const events = {
    open({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab, device), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      remember(tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state, device }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab, ...needed(tab, device).filter((t2) => t2 !== tab)] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tabId = next.slice(5);
        const m = memo.get(tabId);
        if (!m) return { state: { pending: rest } };
        const cards = [...m.data.slides, ...m.data.rails.flatMap((r) => r.items.slice(0, 6)), ...m.data.rails.flatMap((r) => r.items.slice(6))];
        const asked = await meta.fill(cards.map(metaAsk), 12e3);
        const made = slidesFrom(m.data.rails);
        if (made.length > m.data.slides.length) {
          m.data = { ...m.data, slides: made.map(({ logo: logo2, ...rest2 }) => rest2) };
          writeSnap(tabId, m.data);
        }
        const tries = (metaTries.get(tabId) || 0) + 1;
        metaTries.set(tabId, tries);
        if (asked > 0 && tries < MAX_META_TICKS && cards.some((c) => !meta.asked(c.id))) return { state: { pending: [next, ...rest] } };
        return { state: { pending: rest } };
      }
      try {
        const ok = await load(next);
        if (!ok) failLoad(next, rest, failed);
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("browse tab", e && e.code || "error");
        failLoad(next, rest, failed);
      }
      return { state: { pending: rest, failed } };
    },
    // The floating button: straight to the search page, empty and ready for the words.
    openSearch() {
      return { route: { push: "search" }, state: { sq: "", sstate: null } };
    },
    search({ value, route }) {
      const q = value && typeof value.q === "string" ? value.q.trim().slice(0, 100) : "";
      if (q === "") return null;
      const state = { sq: q, sstate: "loading" };
      return route && route.name === "search" ? { state } : { route: { push: "search" }, state };
    },
    // The search page's timer: one search per press, then no timer.
    async stick({ state }) {
      const q = typeof state.sq === "string" ? state.sq : "";
      if (q === "" || state.sstate !== "loading") return null;
      try {
        const out = await searchTitles(q);
        found = { q, items: (Array.isArray(out) ? out : []).slice(0, 60).map(cardOf) };
        rememberFound(found.items);
        return { state: { sstate: "done" } };
      } catch (e) {
        log("browse search", e && e.code || "error");
        return { state: { sstate: "fail" } };
      }
    },
    sretry({ state }) {
      return typeof state.sq === "string" && state.sq !== "" ? { state: { sstate: "loading" } } : null;
    },
    // The gear: the plugin's settings are a page of their own, one Back away.
    go({ arg }) {
      return arg === "settings" ? { route: { push: "settings" }, state: { fromBrowse: true } } : null;
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { sq: null, sstate: null } };
    }
  };
  async function event(ev) {
    const handler = Object.hasOwn(events, ev.name) ? events[ev.name] : null;
    return handler ? await handler({ ...ev, state: ev.state || {} }) ?? null : null;
  }
  return { view, event, notePlayed };
}

// src/plugin.js
var HOST = "addonlatam.duckdns.org";
var ROW_MAX = 60;
var MAX_SKIP = 3e3;
var MAX_TMDB_PAGE = 25;
var IMG = "https://image.tmdb.org/t/p/w342";
var IMG_WIDE = "https://image.tmdb.org/t/p/w780";
var LIST_TIMEOUT_MS = 8e3;
var RESOLVE_TIMEOUT_MS = 9e3;
var TYPES = [
  { type: "movie", label: "Pel\xEDculas", labelEn: "Movies", genre: "peliculas" },
  { type: "series", label: "Series", labelEn: "Series", genre: "series" }
];
var GENRES = {
  movie: [
    { id: 28, es: "Acci\xF3n", en: "Action" },
    { id: 35, es: "Comedia", en: "Comedy" },
    { id: 18, es: "Drama", en: "Drama" },
    { id: 27, es: "Terror", en: "Horror" },
    { id: 878, es: "Ciencia ficci\xF3n", en: "Sci-Fi" },
    { id: 16, es: "Animaci\xF3n", en: "Animation" },
    { id: 53, es: "Suspenso", en: "Thriller" },
    { id: 10749, es: "Romance", en: "Romance" },
    { id: 10751, es: "Familia", en: "Family", vocab: "infantil" },
    { id: 12, es: "Aventura", en: "Adventure" },
    { id: 99, es: "Documental", en: "Documentary", vocab: "documentales" }
  ],
  series: [
    { id: 10759, es: "Acci\xF3n y aventura", en: "Action & Adventure" },
    { id: 35, es: "Comedia", en: "Comedy" },
    { id: 18, es: "Drama", en: "Drama" },
    { id: 9648, es: "Misterio", en: "Mystery" },
    { id: 80, es: "Crimen", en: "Crime" },
    { id: 16, es: "Animaci\xF3n", en: "Animation" },
    { id: 10765, es: "Ciencia ficci\xF3n y fantas\xEDa", en: "Sci-Fi & Fantasy" },
    { id: 99, es: "Documental", en: "Documentary", vocab: "documentales" }
  ]
};
var TEXTS = {
  es: {
    needUrl: "No se pudo abrir el c\xF3digo sellado del plugin: inst\xE1lalo desde su rama principal, sin @rama.",
    unavailable: "PelicuSeries no responde ahora. Intenta de nuevo en un rato.",
    noStreams: "Este t\xEDtulo no tiene video disponible por ahora. Prueba otro o vuelve m\xE1s tarde.",
    noEpisodes: "Este t\xEDtulo no trae lista de episodios.",
    rowNew: "Estrenos \u2014 {name}",
    sectionHero: "Estrenos al d\xEDa.",
    copy: "Opci\xF3n {n}",
    cacheStatus: "Cach\xE9: {n} entradas, {kb} KB",
    cacheCleared: "Listo: se vaci\xF3 la cach\xE9",
    healthOk: "responde",
    healthFail: "falla",
    healthNone: "sin datos",
    probeOk: "Listo: el servicio responde",
    probeFail: "El servicio no responde ahora",
    tileMovies: "Estrenos de cine",
    tileSeries: "Estrenos de series",
    shelfPop: "Populares",
    shelfTop: "Mejor valoradas",
    tabNew: "Estrenos",
    noTmdb: "Este t\xEDtulo no se pudo identificar. Prueba otro.",
    langLatino: "Latino",
    langCastellano: "Castellano",
    langSub: "Subtitulado",
    langEn: "Ingl\xE9s"
  },
  en: {
    needUrl: "The plugin's sealed code could not be opened: install it from its default branch, without a @branch.",
    unavailable: "PelicuSeries isn't responding right now. Try again in a while.",
    noStreams: "This title has no video available right now. Try another or come back later.",
    noEpisodes: "This title has no episode list.",
    rowNew: "New \u2014 {name}",
    sectionHero: "Fresh releases.",
    copy: "Option {n}",
    cacheStatus: "Cache: {n} entries, {kb} KB",
    cacheCleared: "Done: the cache is empty",
    healthOk: "responding",
    healthFail: "failing",
    healthNone: "no data",
    probeOk: "Done: the service responds",
    probeFail: "The service is not responding right now",
    tileMovies: "New in cinemas",
    tileSeries: "New series",
    shelfPop: "Popular",
    shelfTop: "Top rated",
    tabNew: "New",
    noTmdb: "This title could not be identified. Try another.",
    langLatino: "Latin Spanish",
    langCastellano: "Castilian",
    langSub: "Subtitled",
    langEn: "English"
  }
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
var CACHE_PREFIX = "c1:";
var HARD_TTL_MS = 24 * 60 * 60 * 1e3;
var ENTRY_MAX_CHARS = 48 * 1024;
var FRESH_NEW_MS = 15 * 60 * 1e3;
var FRESH_META_MS = 60 * 60 * 1e3;
var FRESH_ART_MS = 12 * 60 * 60 * 1e3;
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
var enc = encodeURIComponent;
function base() {
  try {
    return `https://${HOST}/${kino.secret("addonCode")}`;
  } catch {
    throw kino.error("auth_required", "the sealed addon code is not available", { userMessage: t("needUrl") });
  }
}
async function getJson(path, timeoutMs) {
  let r;
  try {
    r = await kino.fetch(base() + path, { timeoutMs: timeoutMs || 15e3 });
  } catch (e) {
    recordHealth(false);
    throw e;
  }
  if (!r.ok) {
    recordHealth(false);
    throw kino.error("unavailable", "PelicuSeries answered " + r.status, { userMessage: t("unavailable") });
  }
  try {
    const body = await r.json();
    recordHealth(true);
    return body;
  } catch {
    recordHealth(false);
    throw kino.error("unavailable", "PelicuSeries answered something that is not JSON", { userMessage: t("unavailable") });
  }
}
function newUrl(type, skip) {
  return `/catalog/${type}/addonlatam-estrenos${skip > 0 ? "/skip=" + skip : ""}.json`;
}
function searchUrl(type, query) {
  return `/catalog/${type}/addonlatam-estrenos/search=${enc(query)}.json`;
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
var HEALTH_KEY = "health";
var DOWN_AFTER = 3;
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
  }
}
var MAX_ID = 128;
function kinoId(addonId) {
  const clean = String(addonId || "").replace(/:/g, "~").replace(/[^A-Za-z0-9._~-]/g, "-") || "unknown";
  if (clean.length <= MAX_ID) return clean;
  return clean.slice(0, MAX_ID - 9) + "-" + kino.crypto.hash("sha1", String(addonId)).slice(0, 8);
}
var IMDB = /^tt\d{5,10}$/;
function cleanTitle(name) {
  return String(name || "").replace(/\s*[-–]\s*(?:19|20)\d{2}\s*$/, "").replace(/\s*\((?:19|20)\d{2}\)\s*$/, "").trim().slice(0, 200);
}
function toItem(m, type) {
  const movie = type === "movie";
  const item = { id: kinoId(m.id), ref: (movie ? "m:" : "i:") + m.id, title: cleanTitle(m.name), kind: movie ? "movie" : "series" };
  if (m.poster) item.poster = String(m.poster);
  return item;
}
function itemsOf(body, type) {
  return body && Array.isArray(body.metas) ? body.metas.filter((m) => m && m.id && m.name).map((m) => toItem(m, type)) : [];
}
var SEARCH_REQUEST_MS = 6500;
var SEARCH_BUDGET_MS = 12500;
var SEARCH_MIN_LEFT_MS = 3e3;
async function search(query) {
  const started = Date.now();
  const timeLeft = () => SEARCH_BUDGET_MS - (Date.now() - started);
  let failures = 0;
  const q = kino.rank.shortQuery(String(query.q || "").trim());
  if (!q) return [];
  const wanted = TYPES.filter((x) => query.type !== "movie" && query.type !== "series" ? true : x.type === query.type);
  const titles = [query.q, query.originalTitle].concat(Array.isArray(query.altTitles) ? query.altTitles : []).filter((x) => typeof x === "string" && x.trim());
  async function run(text) {
    const lists = await mapLimit(wanted, 2, async (x) => {
      try {
        return itemsOf(await getJson(searchUrl(x.type, text), Math.max(1e3, Math.min(SEARCH_REQUEST_MS, timeLeft()))), x.type);
      } catch (e) {
        failures += 1;
        kino.log("search " + x.type + " failed: " + (e && e.message));
        return [];
      }
    });
    const merged = [];
    const longest = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < longest; i++) for (const l of lists) if (l[i]) merged.push(l[i]);
    const seen = /* @__PURE__ */ new Set();
    return merged.filter((it) => seen.has(it.id) ? false : (seen.add(it.id), true));
  }
  let found = await run(q);
  if (!found.length && failures === 0 && timeLeft() >= SEARCH_MIN_LEFT_MS) {
    const other = titles.map((x) => kino.rank.shortQuery(x.trim())).find((x) => x && x.toLowerCase() !== q.toLowerCase());
    if (other) found = await run(other);
  }
  return kino.rank.sortBySimilarity(found, titles);
}
var FRESH_SHELF_MS = 6 * 60 * 60 * 1e3;
var FRESH_IMDB_MS = 7 * 24 * 60 * 60 * 1e3;
function hasTmdb() {
  return typeof kino.tmdb === "function";
}
function tmdbLang() {
  return isSpanish() ? "es-MX" : "en-US";
}
function typeOf(type) {
  return TYPES.find((x) => x.type === type);
}
function shelfInfo(type, shelf) {
  if (shelf === "pop") return { title: t("shelfPop"), genre: typeOf(type).genre, params: { sort_by: "popularity.desc", "vote_count.gte": 50 } };
  if (shelf === "top") return { title: t("shelfTop"), genre: typeOf(type).genre, params: { sort_by: "vote_average.desc", "vote_count.gte": 1500 } };
  const m = /^g(\d{1,6})$/.exec(String(shelf));
  const g = m && GENRES[type] && GENRES[type].find((x) => x.id === parseInt(m[1], 10));
  if (!g) return null;
  return { title: isSpanish() ? g.es : g.en, genre: g.vocab || typeOf(type).genre, params: { sort_by: "popularity.desc", "vote_count.gte": 100, with_genres: g.id } };
}
function tmdbItem(m, type) {
  const poster = m.poster_path ? IMG + m.poster_path : "";
  const title = String(m.title || m.name || "").trim();
  if (!poster || !title || !Number.isInteger(m.id)) return null;
  const movie = type === "movie";
  const item = { id: "tmdb-" + m.id, ref: (movie ? "m:" : "i:") + "tmdb:" + m.id, title: title.slice(0, 200), kind: movie ? "movie" : "series", poster, ids: { tmdb: m.id } };
  if (m.backdrop_path) item.backdrop = IMG_WIDE + m.backdrop_path;
  const year = /^(\d{4})/.exec(String(m.release_date || m.first_air_date || ""));
  if (year) item.year = year[1];
  if (m.overview) item.overview = String(m.overview).slice(0, 300);
  if (typeof m.vote_average === "number" && m.vote_average > 0) item.rating = Math.round(m.vote_average * 10) / 10;
  return item;
}
async function shelfPage(type, shelf, page) {
  const info = shelfInfo(type, shelf);
  if (!info || !hasTmdb()) throw kino.error("not_found", "unknown shelf " + type + ":" + String(shelf).slice(0, 20));
  const body = await kino.tmdb("/discover/" + (type === "movie" ? "movie" : "tv"), { ...info.params, language: tmdbLang(), page, include_adult: false });
  const results = body && Array.isArray(body.results) ? body.results : [];
  return {
    items: results.map((m) => tmdbItem(m, type)).filter(Boolean),
    more: Number(body && body.total_pages) > page && page < MAX_TMDB_PAGE
  };
}
async function shelfRow(type, shelf, prefixed) {
  const info = shelfInfo(type, shelf);
  if (!info || !hasTmdb()) return null;
  try {
    const lang = isSpanish() ? "es" : "en";
    const first = await cached(`shelf2:${type}:${shelf}:${lang}`, FRESH_SHELF_MS, async () => (await shelfPage(type, shelf, 1)).items);
    if (!first.length) return null;
    const name = typeLabel(typeOf(type));
    return { id: `d-${type}-${shelf}`, title: prefixed ? `${info.title} \u2014 ${name}` : info.title, ref: `d:${type}:${shelf}`, items: first.slice(0, ROW_MAX), genre: info.genre };
  } catch (e) {
    kino.log(`shelf ${type}:${shelf} failed: ` + (e && e.message));
    return null;
  }
}
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
var HOME_BUDGET_MS = 14e3;
var HOME_STALE_MS = 12 * 60 * 60 * 1e3;
var HOME_ITEMS = 20;
async function settleWithin(jobs, ms) {
  const out = new Array(jobs.length);
  const settled = jobs.map((job, i) => Promise.resolve().then(job).then((v) => {
    out[i] = v;
  }, () => {
  }));
  const all = Promise.all(settled).then(() => true);
  const deadline = Date.now() + ms;
  for (; ; ) {
    const left = Math.floor(deadline - Date.now());
    if (left <= 0) break;
    if (await Promise.race([all, kino.sleep(Math.min(5e3, left)).then(() => false)])) break;
  }
  return out;
}
function homeSaved(key) {
  const hit = cacheRead(key);
  return hit && Array.isArray(hit.v) && Date.now() - hit.at < HOME_STALE_MS ? hit : null;
}
async function home() {
  if (kino.config.get("homeRows") === false) return [];
  const key = "home:" + (isSpanish() ? "es" : "en");
  const jobs = [
    () => newRow(TYPES[0]),
    () => newRow(TYPES[1]),
    () => shelfRow("movie", "pop", true),
    () => shelfRow("series", "pop", true)
  ];
  const rows = (await settleWithin(jobs, HOME_BUDGET_MS)).filter(Boolean);
  if (!rows.length) {
    const saved = homeSaved(key);
    if (saved) {
      kino.log("Home: no row arrived, serving the last good one");
      return saved.v;
    }
    return rows;
  }
  const prev = homeSaved(key);
  if (!prev || rows.length >= prev.v.length) {
    cacheWrite(key, rows.map((r) => ({ ...r, items: r.items.slice(0, HOME_ITEMS).map(({ overview, ...rest }) => rest) })));
  }
  return rows;
}
async function browse(ref, cursor) {
  const n = /^n:(movie|series)$/.exec(String(ref || ""));
  if (n) {
    const type = n[1];
    const skip = Math.max(0, parseInt(cursor || "0", 10) || 0);
    const items = skip === 0 ? await newItems({ type }) : itemsOf(await getJson(newUrl(type, skip), 15e3), type);
    const page = items.slice(0, 100);
    return items.length && skip + items.length < MAX_SKIP ? { items: page, next: String(skip + items.length) } : { items: page };
  }
  const d = /^d:(movie|series):([a-z0-9]+)$/.exec(String(ref || ""));
  if (d) {
    const page = Math.min(MAX_TMDB_PAGE, Math.max(1, parseInt(cursor || "1", 10) || 1));
    const r = await shelfPage(d[1], d[2], page);
    return r.more ? { items: r.items, next: String(page + 1) } : { items: r.items };
  }
  throw kino.error("not_found", "unknown browse ref: " + String(ref).slice(0, 60));
}
function shelvesOf(type) {
  return ["pop", "top"].concat((GENRES[type] || []).map((g) => "g" + g.id));
}
async function section({ tab }) {
  const tabs = [{ id: "new", label: t("tabNew") }, ...TYPES.map((x) => ({ id: x.type, label: typeLabel(x) }))];
  const chosen = tabs.some((x) => x.id === tab) ? tab : tabs[0].id;
  const jobs = chosen === "new" ? TYPES.map((x) => () => newRow(x)) : shelvesOf(chosen).map((shelf) => () => shelfRow(chosen, shelf, false));
  const rows = (await mapLimit(jobs, 4, (job) => job())).filter(Boolean);
  const answer = { tabs, tab: chosen, rows };
  if (rows.length) {
    const items = rows[0].items;
    const pick = items[Math.floor(Date.now() / 864e5) % items.length];
    answer.hero = { title: pick.title, text: t("sectionHero") };
    if (pick.poster) answer.hero.image = pick.poster;
  }
  return answer;
}
async function tabPage(tab) {
  const type = tab === "peliculas" ? "movie" : tab === "series" ? "series" : null;
  const jobs = type === null ? [() => newRow(TYPES[0]), () => newRow(TYPES[1]), () => shelfRow("movie", "pop", true), () => shelfRow("series", "pop", true)] : shelvesOf(type).slice(0, 8).map((shelf) => () => shelfRow(type, shelf, false));
  return { rows: (await mapLimit(jobs, 4, (job) => job())).filter(Boolean) };
}
var browseInstance = null;
var browseScreen = () => browseInstance ?? (browseInstance = makeBrowse({
  kino,
  loadTab: (tab) => tabPage(tab),
  searchTitles: (q) => search({ q }),
  imdbOfTmdb: imdbOfTmdbSync
}));
async function screen(ctx) {
  await null;
  return browseScreen().view(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return browseScreen().event(ev && typeof ev === "object" ? ev : {});
}
async function categories() {
  const tiles = [
    { id: "movie", title: t("tileMovies"), ref: "n:movie", art: () => newItems(TYPES[0]) },
    { id: "series", title: t("tileSeries"), ref: "n:series", art: () => newItems(TYPES[1]) }
  ];
  if (hasTmdb()) {
    for (const x of TYPES) {
      const name = typeLabel(x);
      for (const shelf of ["pop"].concat((GENRES[x.type] || []).map((g) => "g" + g.id))) {
        const info = shelfInfo(x.type, shelf);
        tiles.push({ id: `${x.type}-${shelf}`, title: `${name}: ${info.title}`.slice(0, 40), ref: `d:${x.type}:${shelf}`, art: async () => (await shelfPage(x.type, shelf, 1)).items });
      }
    }
  }
  const lang = isSpanish() ? "es" : "en";
  return await mapLimit(tiles.slice(0, 24), 4, async (tile) => {
    let art = "";
    try {
      art = await cached(`art:${tile.id}:${lang}`, FRESH_ART_MS, async () => {
        const first = (await tile.art())[0];
        return first && first.poster ? first.poster : "";
      });
    } catch (e) {
      kino.log("art " + tile.id + " failed: " + (e && e.message));
    }
    const out = { id: tile.id, title: tile.title, ref: tile.ref };
    if (art) out.art = art;
    return out;
  });
}
function idOf(ref, prefix) {
  const s = String(ref || "");
  return s.startsWith(prefix) && s.length > prefix.length ? s.slice(prefix.length) : null;
}
async function imdbOf(type, id) {
  if (IMDB.test(id)) return id;
  const m = /^tmdb:(\d{1,9})$/.exec(String(id));
  if (!m || !hasTmdb()) return null;
  const found = await cached(`imdb:${type}:${m[1]}`, FRESH_IMDB_MS, async () => {
    const body = await kino.tmdb(`/${type === "movie" ? "movie" : "tv"}/${m[1]}/external_ids`);
    return body && IMDB.test(String(body.imdb_id || "")) ? String(body.imdb_id) : "";
  });
  if (found) rememberImdb(found, m[1]);
  return found || null;
}
var REV_KEY = "rev1";
var REV_MAX = 120;
function readRev() {
  try {
    const o = JSON.parse(kino.storage.get(REV_KEY) || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}
function rememberImdb(imdb, tmdb) {
  try {
    const rev = readRev();
    if (rev[imdb] === tmdb) return;
    delete rev[imdb];
    rev[imdb] = tmdb;
    const keys = Object.keys(rev);
    for (const k of keys.slice(0, Math.max(0, keys.length - REV_MAX))) delete rev[k];
    kino.storage.set(REV_KEY, JSON.stringify(rev));
  } catch {
  }
}
function imdbOfTmdbSync(tmdb) {
  const rev = readRev();
  return Object.keys(rev).find((k) => String(rev[k]) === String(tmdb)) || "";
}
async function metaOf(type, id) {
  const imdb = await imdbOf(type, id);
  if (!imdb || typeof kino.meta !== "function") return null;
  return cached(`meta:${type}:${imdb}`, FRESH_META_MS, async () => {
    const m = await kino.meta({ type, ids: { imdb }, lang: kino.lang });
    if (!m) throw kino.error("not_found", "Kino knows nothing about " + imdb);
    return {
      imdb,
      title: m.title || "",
      poster: m.poster || "",
      backdrop: m.backdrop || "",
      overview: String(m.overview || "").slice(0, 2e3),
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
        String(e.airDate || "").slice(0, 10)
      ])
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
async function episodes(ref) {
  const id = idOf(ref, "i:");
  if (!id) throw kino.error("not_found", "not a series ref: " + String(ref).slice(0, 80));
  const meta = await metaOf("series", id);
  if (!meta || !meta.episodes.length) throw kino.error("not_found", "no episode list for " + id.slice(0, 80), { userMessage: t("noEpisodes") });
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const seen = /* @__PURE__ */ new Set();
  const eps = [];
  for (const [season, number, title, overview, still, date] of meta.episodes.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    if (season < 1 || /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today) continue;
    const key = season + ":" + number;
    if (seen.has(key)) continue;
    seen.add(key);
    const ep = { season, number, ref: `e:${meta.imdb}:${season}:${number}` };
    if (title) ep.title = title;
    if (overview) ep.overview = overview;
    if (still) ep.still = still;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) ep.airDate = date;
    eps.push(ep);
  }
  if (!eps.length) throw kino.error("not_found", "no aired episodes for " + id.slice(0, 80), { userMessage: t("noEpisodes") });
  return { series: infoOf(meta), episodes: eps };
}
async function details(ref) {
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
var LANGS = [
  { re: /latino/i, key: "langLatino", rank: 0 },
  { re: /castellano|espa[ñn]a|\bcast\b/i, key: "langCastellano", rank: 1 },
  { re: /subt|\bsub\b|\bvose\b/i, key: "langSub", rank: 2 },
  { re: /ingl[eé]s|english|\bvo\b|original/i, key: "langEn", rank: 3 }
];
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
function copyKey(url, ref, n, index) {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
  }
  return host === HOST ? `o:${ref}|${n || index + 1}` : `h:${host || index}`;
}
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
  const stream = { url, label: parts.join(" \xB7 ").slice(0, 48) };
  return { stream, quality: d.quality, langRank: d.lang ? d.lang.rank : 4, index, tier: tierOf(url), key: copyKey(url, ref, d.n, index) };
}
function qualityRank(q, pref) {
  if (pref === "max") return -q;
  const cap = pref === "720" ? 720 : 1080;
  const v = q || cap;
  return v <= cap ? cap - v : 1e5 + (v - cap);
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
var SERVED_PREFIX = "served:";
var BAD_KEY = "bad";
var REOPEN_WINDOW_MS = 2 * 60 * 1e3;
var BAD_FOR_MS = 10 * 60 * 1e3;
var BAD_MAX = 40;
function readBad() {
  try {
    const raw = JSON.parse(kino.storage.get(BAD_KEY) || "{}");
    const now = Date.now();
    const out = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [k, until] of Object.entries(raw)) if (Number(until) > now) out[k] = Number(until);
    }
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
  }
}
async function resolveRef(ref, options) {
  const movieId = idOf(ref, "m:");
  let path;
  if (movieId) {
    const movie = await imdbOf("movie", movieId);
    if (!movie) throw kino.error("not_found", "no IMDb id for " + movieId.slice(0, 40), { userMessage: t("noTmdb") });
    path = `/stream/movie/${enc(movie)}.json`;
  } else {
    const m = /^e:(.+):(\d{1,3}):(\d{1,5})$/.exec(String(ref || ""));
    if (!m) throw kino.error("not_found", "not a playable ref: " + String(ref).slice(0, 80));
    path = `/stream/series/${enc(`${m[1]}:${m[2]}:${m[3]}`)}.json`;
  }
  const raw = await streamsOf(path);
  const seen = /* @__PURE__ */ new Set();
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
  const reopened = options && options.retry || prev && typeof prev.t === "number" && now - prev.t < REOPEN_WINDOW_MS;
  if (reopened && prev && prev.key) {
    bad[prev.key] = now + BAD_FOR_MS;
    writeBad(bad);
  }
  const pool = raw.map((s, i) => toStream(s, i, ref)).filter((x) => seen.has(x.stream.url) ? false : (seen.add(x.stream.url), true)).sort(
    (a, b) => a.langRank - b.langRank || (bad[a.key] ? 1 : 0) - (bad[b.key] ? 1 : 0) || a.tier - b.tier || qualityRank(a.quality, pref) - qualityRank(b.quality, pref) || a.index - b.index
  );
  if (!pool.length) throw kino.error("not_found", "no streams for " + String(ref).slice(0, 80), { userMessage: t("noStreams") });
  const [first, ...rest] = pool;
  try {
    kino.storage.set(servedKey, JSON.stringify({ t: now, key: first.key }), { ttlMs: BAD_FOR_MS });
  } catch {
  }
  const main = { ...first.stream, expiresInSeconds: 1800 };
  const alternatives = rest.slice(0, 8).map((x) => x.stream);
  if (alternatives.length) main.alternatives = alternatives;
  return main;
}
async function resolve(ref, options) {
  const out = await resolveRef(ref, options);
  try {
    const ep = /^e:(tt\d{5,10}):/.exec(String(ref || ""));
    const movie = idOf(ref, "m:");
    const imdb = ep ? ep[1] : movie ? await imdbOf("movie", movie) : null;
    if (imdb) browseScreen().notePlayed(imdb);
  } catch {
  }
  return out;
}
async function settingsStatus() {
  const keys = cacheKeys();
  let chars = 0;
  for (const k of keys) chars += k.length + (kino.storage.get(k) || "").length;
  const h = readHealth();
  const state = !h || h.ok === void 0 ? "healthNone" : h.ok ? "healthOk" : "healthFail";
  return { cache: t("cacheStatus", { n: keys.length, kb: Math.ceil(chars / 1024) }), health: t(state) };
}
async function action(key) {
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
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus
};
