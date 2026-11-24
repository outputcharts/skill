// Checks that every listing's list of visual types matches the types defined in
// schemas.js (the API's source of truth), and that any stated count of types
// ("eleven visual types", "12 types") equals the real number.
//
//   node check-visual-types.mjs                  types from https://api.outputcharts.com/v1/schema
//   OC_SCHEMA=path/to/schemas.js node check-visual-types.mjs   types from a local schemas.js
//   node check-visual-types.mjs extra.md ...     also checks counts in other files
//
// /v1/schema is generated from schemas.js, so the default needs no checkout.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// How listings name each type in prose. Every type in schemas.js needs an entry.
export const DISPLAY_NAMES = {
  bar: ["bar"],
  "bar-horizontal": ["horizontal bar"],
  line: ["line"],
  area: ["area"],
  pie: ["pie"],
  kpi: ["kpi"],
  table: ["table"],
  markdown: ["markdown"],
  scatter: ["scatter"],
  funnel: ["funnel"],
  gauge: ["gauge"],
  map: ["map"],
};

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty"];

export async function loadSchemaTypes(source = process.env.OC_SCHEMA) {
  if (source && !/^https?:/.test(source)) {
    const mod = await import(pathToFileURL(resolve(source)).href);
    const types = mod.VISUAL_TYPES ?? mod.default?.VISUAL_TYPES;
    if (!Array.isArray(types)) throw new Error(`${source} does not export VISUAL_TYPES`);
    return [...types];
  }
  const url = source || "https://api.outputcharts.com/v1/schema";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} answered ${res.status}`);
  const body = await res.json();
  return body.visualTypes.map((v) => v.type);
}

// "bar, horizontal bar, line, ... gauge and map" -> ["bar", "bar-horizontal", ..., "map"]
export function parseProseList(text) {
  const byName = new Map();
  for (const [type, names] of Object.entries(DISPLAY_NAMES)) for (const n of names) byName.set(n, type);
  return text
    .replace(/\([^)]*\)/g, "")
    .split(/,|\band\b|\bor\b/i)
    .map((s) => s.trim().toLowerCase().replace(/^`|`$/g, ""))
    .filter(Boolean)
    .map((s) => byName.get(s) ?? `UNKNOWN(${s})`);
}

// Every "<count> visual types" / "<count> types" / "<count> chart types" in a text.
export function statedCounts(text) {
  const re = new RegExp(String.raw`(?<![\w-])(${NUMBER_WORDS.join("|")}|\d+)\s+(?:visual\s+|chart\s+)?types\b`, "gi");
  return [...text.matchAll(re)].map((m) => {
    const w = m[1].toLowerCase();
    return { phrase: m[0], count: /^\d+$/.test(w) ? Number(w) : NUMBER_WORDS.indexOf(w) };
  });
}

function longDescription(md) {
  const m = md.match(/## Long description\s*\n([\s\S]*?)(?=\n## |$)/);
  if (!m) throw new Error("mcp-server.md has no '## Long description' section");
  return m[1];
}

// Each listing that spells out the types, and how to pull its list out.
export const LISTINGS = [
  {
    name: "mcp-server.md long description (MCP directories)",
    file: "mcp-server.md",
    lists(src) {
      const text = longDescription(src);
      const m = text.match(/visual types(?: are|:| \()\s*((?:[^.()]|\([^)]*\))+?)(?=\)|,\s*each\b|\.)/i);
      if (!m) throw new Error("long description no longer lists the visual types after 'visual types are'");
      return [parseProseList(m[1])];
    },
  },
  {
    name: "lhm.plugin.json tool enums (LobeHub)",
    file: "lhm.plugin.json",
    lists(src) {
      const found = [];
      (function walk(node, key) {
        if (Array.isArray(node)) node.forEach((n) => walk(n, key));
        else if (node && typeof node === "object") {
          if (key === "type" && Array.isArray(node.enum)) found.push(node.enum);
          for (const [k, v] of Object.entries(node)) walk(v, k);
        }
      })(JSON.parse(src), null);
      if (!found.length) throw new Error("no visual type enum found");
      return found;
    },
  },
];

export const COUNT_FILES = ["mcp-server.md", "README.md", "SKILL.md", "server.json", "glama.json", "lhm.plugin.json"];

export function checkAll(types, { root = here, extraCountFiles = [] } = {}) {
  const problems = [];
  const missingNames = types.filter((t) => !DISPLAY_NAMES[t]);
  if (missingNames.length) problems.push(`DISPLAY_NAMES has no prose name for: ${missingNames.join(", ")}`);
  const want = JSON.stringify(types);
  for (const l of LISTINGS) {
    let lists;
    try {
      lists = l.lists(readFileSync(resolve(root, l.file), "utf8"));
    } catch (e) {
      problems.push(`${l.name}: ${e.message}`);
      continue;
    }
    for (const got of lists) {
      if (JSON.stringify(got) !== want) {
        const missing = types.filter((t) => !got.includes(t));
        const extra = got.filter((t) => !types.includes(t));
        problems.push(`${l.name}: lists [${got.join(", ")}]` +
          (missing.length ? `; missing ${missing.join(", ")}` : "") +
          (extra.length ? `; not in schemas.js: ${extra.join(", ")}` : "") +
          (!missing.length && !extra.length ? "; order differs from schemas.js" : ""));
      }
    }
  }
  for (const f of [...COUNT_FILES.map((f) => resolve(root, f)), ...extraCountFiles]) {
    let src;
    try { src = readFileSync(f, "utf8"); } catch { continue; }
    for (const c of statedCounts(src)) {
      if (c.count !== types.length) problems.push(`${f}: says "${c.phrase}" but schemas.js has ${types.length} types`);
    }
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const types = await loadSchemaTypes();
  const problems = checkAll(types, { extraCountFiles: process.argv.slice(2) });
  console.log(`schemas.js types (${types.length}): ${types.join(", ")}`);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }
  console.log("Every listing matches schemas.js");
}
