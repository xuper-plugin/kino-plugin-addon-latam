// The browse screen: skeletons first, the active tab then the rest as the timer loads them, the featured slider, "Continuar
// viendo", the search page with its history, and a tab that fails. Kino's kit reads every tree as the app does.
import test from "node:test";
import assert from "node:assert/strict";
import { makeBrowse } from "../src/browse/index.js";
import { checkScreenTree, checkScreenAnswer, fakeScreenContext, fakeScreenEvent, childNodes } from "../sdk/screen.mjs";
import manifest from "../kino-plugin.json" with { type: "json" };

const all = (n, out = []) => { if (!n || typeof n !== "object") return out; out.push(n); for (const c of childNodes(n)) all(c, out); return out; };
const byKey = (tree, key) => all(tree).find((n) => n.key === key) ?? null;
const types = (tree) => all(tree).map((n) => n.type);

const item = (kind, n, extra = {}) => ({
  id: `${kind}-${n}`, ref: kind === "tv" ? `i:tt00000${n}` : `m:tt01000${n}`, title: `Título ${kind} ${n}`, kind: kind === "tv" ? "series" : "movie",
  poster: `https://img.test/${kind}${n}p.jpg`, ...extra,
});
const row = (id, title, kind, count = 8) => ({ id, title, ref: `n:${kind === "tv" ? "series" : "movie"}`, items: Array.from({ length: count }, (_, i) => item(kind, i + 1)) });
const pageOf = (tab) => ({ tab, rows: [row(`${tab}-a`, `Estrenos ${tab}`, tab === "series" ? "tv" : "movie"), row(`${tab}-b`, `Recién agregadas ${tab}`, tab === "series" ? "tv" : "movie", 5)] });

function fakeKino(lang = "es-CO") {
  const store = new Map();
  return {
    lang, store,
    meta: Object.assign(async ({ title }) => ({ ids: { tmdb: 7 }, logo: "https://img.test/logo.png", backdrop: "https://img.test/b.jpg", overview: `Sinopsis de ${title}.` }), { byTitle: true }),
    storage: { get: (k) => (store.has(k) ? store.get(k) : null), set: (k, v) => { store.set(k, v); } },
    log() {},
  };
}

function harness({ device = "phone", lang = "es", kino = fakeKino(), failing = new Set(), searchFails = false } = {}) {
  const loaded = [];
  const searched = [];
  const browse = makeBrowse({
    imdbOfTmdb: () => "",
    kino,
    loadTab: async (tab) => { loaded.push(tab); if (failing.has(tab)) throw Object.assign(new Error("down"), { code: "timeout" }); return pageOf(tab); },
    searchTitles: async (q) => { searched.push(q); if (searchFails) throw new Error("down"); return q === "nada" ? [] : [item("movie", 1), item("movie", 2, { adult: true })]; },
  });
  let state = {};
  const routes = [{ name: "main", params: {} }];
  const route = () => routes[routes.length - 1];
  const render = async () => {
    const raw = browse.view(fakeScreenContext({ state: JSON.parse(JSON.stringify(state)), route: route(), device, lang }));
    const r = checkScreenTree(JSON.parse(JSON.stringify(raw)), lang, undefined, { apiVersion: 19, settings: manifest.settings });
    return { raw, tree: r.tree, dropped: r.dropped, every: r.every };
  };
  const send = async (name, { arg, value, timer = false } = {}) => {
    const raw = await browse.event(fakeScreenEvent(name, { arg, value, state: JSON.parse(JSON.stringify(state)), route: route(), device, lang }));
    const r = checkScreenAnswer(JSON.parse(JSON.stringify(raw ?? null)), lang, { timer });
    assert.deepEqual(r.dropped, [], `${name}: nothing of the answer dropped`);
    if (raw && raw.state) for (const [k, v] of Object.entries(raw.state)) { if (v === null) delete state[k]; else state[k] = v; }
    if (raw && raw.route) { if (raw.route.pop) { if (routes.length > 1) routes.pop(); } else routes.push({ name: raw.route.push, params: {} }); }
    return raw;
  };
  return { browse, render, send, loaded, searched, kino, get state() { return state; }, route: () => route().name, push: (name) => routes.push({ name, params: {} }) };
}

test("before anything is kept: skeletons for the slider and the rails, three tabs, no timer until open", async () => {
  const h = harness();
  const r = await h.render();
  assert.deepEqual(r.dropped, []);
  assert.ok(types(r.tree).includes("skeleton"));
  assert.ok(!types(r.tree).includes("pageView") && !types(r.tree).includes("titleRail"));
  assert.deepEqual(byKey(r.tree, "tabs").tabs.map((t) => t.value), ["inicio", "peliculas", "series"]);
  assert.equal((r.every || []).length, 0);
});

test("open on a phone queues the active tab first then the others; the timer loads one per tick and the tree fills", async () => {
  const h = harness();
  await h.send("open");
  assert.deepEqual(h.state.pending, ["inicio", "peliculas", "series"]);
  assert.ok((await h.render()).every.length > 0, "a timer while something is pending");
  await h.send("tick", { timer: true });
  assert.deepEqual(h.loaded, ["inicio"]);
  await h.send("tick", { timer: true }); // Kino's metadata for the first titles: backdrops and synopses make the slides
  const r = await h.render();
  assert.deepEqual(r.dropped, []);
  assert.ok(types(r.tree).includes("pageView"), "the featured slider");
  assert.equal(byKey(r.tree, "hero").autoPlayMs, 6000);
  assert.equal(all(r.tree).filter((n) => n.type === "titleRail").length, 2);
  while ((h.state.pending || []).length > 0) await h.send("tick", { timer: true });
  assert.deepEqual(h.loaded, ["inicio", "peliculas", "series"]);
  assert.equal((h.state.pending || []).length, 0);
  assert.equal(((await h.render()).every || []).length, 0, "nothing pending: no timer");
});

test("on a TV only the tab in view is loaded; the others load when selected", async () => {
  const h = harness({ device: "tv" });
  await h.send("open");
  assert.deepEqual(h.state.pending, ["inicio"]);
  await h.send("tick", { timer: true });
  await h.send("tab", { value: "series" });
  assert.deepEqual(h.state.pending, ["series", "meta:inicio"]);
  assert.ok(types((await h.render()).tree).includes("skeleton"), "the new tab shows skeletons until it arrives");
  await h.send("tick", { timer: true });
  assert.deepEqual(h.loaded, ["inicio", "series"]);
});

test("a tab loaded before paints at once on the next opening from its kept copy", async () => {
  const kino = fakeKino();
  const first = harness({ kino });
  await first.send("open");
  await first.send("tick", { timer: true });
  await first.send("tick", { timer: true }); // the metadata tick: the slides are kept with the tab
  assert.ok([...kino.store.keys()].some((k) => k.startsWith("browse1:")));
  const second = harness({ kino });
  await second.send("open");
  const r = await second.render();
  assert.deepEqual(r.dropped, []);
  assert.ok(types(r.tree).includes("titleRail") && !types(r.tree).includes("skeleton"));
});

test("a tab that cannot load says so with a retry; the retry loads it again", async () => {
  const failing = new Set(["inicio"]);
  const h = harness({ failing });
  await h.send("open");
  await h.send("tick", { timer: true });
  assert.ok(!byKey((await h.render()).tree, "loadFailed"), "asked again before the banner shows");
  while (h.state.pending && h.state.pending.includes("inicio")) await h.send("tick", { timer: true });
  const r = await h.render();
  assert.deepEqual(r.dropped, []);
  assert.ok(byKey(r.tree, "loadFailed"));
  failing.clear();
  await h.send("retry");
  assert.equal(h.state.pending[0], "inicio");
  await h.send("tick", { timer: true });
  assert.ok(types((await h.render()).tree).includes("titleRail"));
});

test("Continuar viendo: played titles come first, newest first, found by their IMDb id; one not on screen is not shown", async () => {
  const h = harness();
  await h.send("open");
  while ((h.state.pending || []).length > 0) await h.send("tick", { timer: true });
  h.browse.notePlayed("tt010003"); // movie 3
  h.browse.notePlayed("tt000002"); // series 2 (an episode was played)
  h.browse.notePlayed("tt9999999"); // not on screen
  h.browse.notePlayed("garbage");
  const r = await h.render();
  assert.deepEqual(r.dropped, []);
  const rail = byKey(r.tree, "recent");
  assert.equal(rail.title, "Continuar viendo");
  assert.deepEqual(rail.items.map((i) => i.id), ["tv-2", "movie-3"]);
  assert.equal(all(r.tree).filter((n) => n.type === "titleRail")[0].key, "recent");
});

test("the floating button opens the search page; words show skeletons then a grid; empty page paints earlier finds; back returns", async () => {
  const h = harness();
  await h.send("open");
  const home = await h.render();
  assert.equal(home.raw.floatingActionButton.icon, "search");
  await h.send("openSearch");
  assert.equal(h.route(), "search");
  const idle = await h.render();
  assert.deepEqual(idle.dropped, []);
  assert.ok(byKey(idle.tree, "q") && !types(idle.tree).includes("skeleton"));
  assert.equal(await h.send("search", { value: { q: "   " } }), null);
  await h.send("search", { value: { q: "  dune  " } });
  const loading = await h.render();
  assert.ok(types(loading.tree).includes("skeleton") && (loading.every || []).length > 0);
  await h.send("stick", { timer: true });
  assert.deepEqual(h.searched, ["dune"]);
  const done = await h.render();
  assert.deepEqual(done.dropped, []);
  const grid = byKey(done.tree, "results");
  assert.equal(grid.items.length, 2);
  assert.equal(grid.items[1].adult, true, "Kino hides it unless the 18+ code is unlocked");
  await h.send("back");
  assert.equal(h.route(), "main");
  await h.send("openSearch");
  const again = await h.render();
  assert.equal(byKey(again.tree, "history").items.length, 1, "the adult one was not kept");
  await h.send("search", { value: { q: "otra" } });
  assert.equal(byKey((await h.render()).tree, "history"), null, "a real search replaces it");
});

test("a search that finds nothing says so; one that fails offers a retry", async () => {
  const h = harness();
  await h.send("open");
  await h.send("openSearch");
  await h.send("search", { value: { q: "nada" } });
  await h.send("stick", { timer: true });
  assert.ok(all((await h.render()).tree).some((n) => n.type === "text" && /encontramos/.test(String(n.text))));
  const bad = harness({ searchFails: true });
  await bad.send("open");
  await bad.send("openSearch");
  await bad.send("search", { value: { q: "otra" } });
  await bad.send("stick", { timer: true });
  assert.ok(byKey((await bad.render()).tree, "searchFailed"));
});

test("in English every tree draws with nothing dropped, on the phone and on the TV", async () => {
  for (const device of ["phone", "tv"]) {
    const h = harness({ device, lang: "en" });
    await h.send("open");
    await h.send("tick", { timer: true });
    const r = await h.render();
    assert.deepEqual(r.dropped, [], device);
    assert.equal(byKey(r.tree, "tabs").tabs[1].label, "Movies");
  }
});

test("the gear opens the settings page (Kino's own form in the same one bar); back returns, or closes when opened on its own", async () => {
  const h = harness();
  await h.send("open");
  const home = await h.render();
  assert.ok(home.raw.appBar.actions.some((a) => a.key === "settingsButton" && a.icon === "settings"));
  await h.send("go", { arg: "settings" });
  assert.equal(h.route(), "settings");
  const r = await h.render();
  assert.deepEqual(r.dropped, []);
  assert.ok(types(r.tree).includes("settings") || all(r.tree).some((n) => n.key === "form"));
  await h.send("back");
  assert.equal(h.route(), "main");
  const alone = harness();
  alone.push("settings");
  assert.deepEqual(await alone.send("back"), { close: true });
});

test("metadata is asked for the name without its brackets, with the year", async () => {
  const { metaAsk } = await import("../src/browse/index.js");
  assert.deepEqual(metaAsk({ id: "a", title: "Kick (2023)", kind: "movie" }), { id: "a", title: "Kick", kind: "movie", year: 2023 });
  assert.deepEqual(metaAsk({ id: "b", title: "DARK (Season 1)", kind: "series" }), { id: "b", title: "DARK", kind: "series" });
});
