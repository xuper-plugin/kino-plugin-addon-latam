#!/usr/bin/env node
// Re-vendors Kino's Node kit into this repository, in one step that can be run again whenever Kino's kit changes.
//
//   node scripts/sync-kit.mjs <kino checkout> [--dry-run]
//
// <kino checkout> is a checkout of Kino's code (the folder holding plugins/sdk and docs/plugins). What it copies:
//   - plugins/sdk/*.mjs                -> sdk/            (every module; a module Kino dropped is dropped here too)
//   - plugins/sdk/test/<VENDORED_TESTS> -> sdk/test/      (the kit's own tests and demos this repository has always kept)
//   - docs/plugins/contract.json       -> contract.json
//   - docs/plugins/kino.d.ts           -> kino.d.ts
//   - docs/plugins/README.md           -> GUIDE.md
// Nothing of the plugin itself (src/, test/, kino-plugin.json, plugin.js) is touched. Run `npm test` afterwards.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The kit tests and demo folders this repository keeps under sdk/test (the others need Kino's whole tree). */
const VENDORED_TESTS = ["kit.test.mjs", "signed-plugins.test.mjs", "section-demo", "settings-demo"];

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const positional = args.filter((a) => !a.startsWith("--"));
if (positional.length !== 1) {
  console.error("usage: node scripts/sync-kit.mjs <kino checkout> [--dry-run]");
  process.exit(2);
}
const KINO = resolve(positional[0]);
const KIT = join(KINO, "plugins", "sdk");
const DOCS = join(KINO, "docs", "plugins");
for (const p of [join(KIT, "contract.mjs"), join(DOCS, "contract.json"), join(DOCS, "kino.d.ts"), join(DOCS, "README.md")]) {
  if (!existsSync(p)) { console.error(`not a Kino checkout: ${p} is missing`); process.exit(2); }
}

const changes = [];
const sha = (b) => createHash("sha256").update(b).digest("hex");
function write(path, content) {
  const old = existsSync(path) ? readFileSync(path) : null;
  if (old && sha(old) === sha(content)) return;
  changes.push(`${old ? "updated" : "added"} ${relative(REPO, path).replaceAll("\\", "/")}`);
  if (!DRY) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); }
}
function remove(path) {
  changes.push(`removed ${relative(REPO, path).replaceAll("\\", "/")}`);
  if (!DRY) rmSync(path, { recursive: true, force: true });
}
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p).map((x) => join(n, x)) : [n];
});

// 1. The kit's modules, mirrored.
const modules = readdirSync(KIT).filter((n) => n.endsWith(".mjs"));
for (const n of modules) write(join(REPO, "sdk", n), readFileSync(join(KIT, n)));
for (const n of readdirSync(join(REPO, "sdk"))) {
  if (n.endsWith(".mjs") && !modules.includes(n)) remove(join(REPO, "sdk", n));
}

// 2. The kit tests and demos this repository keeps (mirrored inside each vendored folder).
for (const entry of VENDORED_TESTS) {
  const from = join(KIT, "test", entry);
  const to = join(REPO, "sdk", "test", entry);
  if (!existsSync(from)) { if (existsSync(to)) remove(to); continue; }
  if (statSync(from).isDirectory()) {
    const wanted = new Set(walk(from));
    for (const rel of wanted) write(join(to, rel), readFileSync(join(from, rel)));
    if (existsSync(to)) for (const rel of walk(to)) if (!wanted.has(rel)) remove(join(to, rel));
  } else {
    write(to, readFileSync(from));
  }
}

// 3. The contract, the types and the guide.
write(join(REPO, "contract.json"), readFileSync(join(DOCS, "contract.json")));
write(join(REPO, "kino.d.ts"), readFileSync(join(DOCS, "kino.d.ts")));
write(join(REPO, "GUIDE.md"), readFileSync(join(DOCS, "README.md")));

let where = KINO;
try {
  const head = execFileSync("git", ["-C", KINO, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const branch = execFileSync("git", ["-C", KINO, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
  where = `${branch} at ${head}`;
} catch { /* not a git checkout: the path is enough */ }
console.log(changes.length ? changes.join("\n") : "already in sync: nothing changed");
console.log(`\nkit source: ${where}${DRY ? " (dry run: nothing written)" : ""}`);
if (changes.length && !DRY) console.log("Next: npm test (the old tests must pass unchanged).");
