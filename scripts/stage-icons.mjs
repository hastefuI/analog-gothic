#!/usr/bin/env node
/**
 * stage-icons.mjs
 *
 * Intake step for new icons. Reads raw SVGs from the stage directory,
 * normalizes each filename to the kit's `ag-<name>.svg` convention,
 * validates the markup, optimizes it, and writes it into the icon source
 * directory. Staged files are removed once accepted unless --keep is passed.
 *
 * Usage:
 *   node scripts/stage-icons.mjs --in ./stage --out ./icons [--prefix ag-]
 *                                [--force] [--keep] [--dry-run]
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { optimize } from "svgo";
import { svgoConfig } from "./svgo.config.mjs";

const ENCODING = "utf8";
const argv = process.argv.slice(2);

function arg(flag, fallback = null) {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
}
const hasFlag = (flag) => argv.includes(flag);

const inDir = path.resolve(process.cwd(), arg("--in", "./stage"));
const outDir = path.resolve(process.cwd(), arg("--out", "./icons"));
const prefix = arg("--prefix", "ag-");
const force = hasFlag("--force");
const keep = hasFlag("--keep");
const dryRun = hasFlag("--dry-run");

/** `Book Icon_v2.svg` -> `ag-book-icon-v2` (never double-prefixed). */
function toSlug(basename, pfx) {
  const slug = path
    .basename(basename, path.extname(basename))
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  if (!slug) return null;
  return slug.startsWith(pfx) ? slug : `${pfx}${slug}`;
}

/** Reject anything the sprite builder cannot consume, or that is unsafe to inline. */
function validate(svg) {
  const problems = [];
  if (!/<svg\b/i.test(svg) || !/<\/svg>/i.test(svg)) problems.push("no <svg> wrapper");
  if (!/\bviewBox\s*=/i.test(svg) && !(/\bwidth\s*=/i.test(svg) && /\bheight\s*=/i.test(svg))) {
    problems.push("no viewBox and no width/height to derive one from");
  }
  if (/<script\b/i.test(svg)) problems.push("contains <script>");
  if (/<foreignObject\b/i.test(svg)) problems.push("contains <foreignObject>");
  if (/\son\w+\s*=/i.test(svg)) problems.push("contains inline event handler attribute");
  return problems;
}

const isSvg = (name) => name.toLowerCase().endsWith(".svg");

/** Prefer a repo-relative path, but fall back to absolute rather than a ../../ chain. */
function display(p) {
  const rel = path.relative(process.cwd(), p);
  return !rel || rel.startsWith("..") ? p : rel;
}

async function main() {
  const stat = await fs.stat(inDir).catch(() => null);
  if (!stat?.isDirectory()) {
    console.error(`Stage directory not found: ${inDir}`);
    process.exit(1);
  }

  const entries = await fs.readdir(inDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && isSvg(e.name)).map((e) => e.name).sort();

  if (files.length === 0) {
    console.error(`No SVGs found in ${inDir}`);
    console.error(`Drop new icons there, then re-run.`);
    process.exit(1);
  }

  await fs.mkdir(outDir, { recursive: true });

  const accepted = [];
  const rejected = [];
  const seen = new Map();

  for (const name of files) {
    const src = path.join(inDir, name);
    const slug = toSlug(name, prefix);

    if (!slug) {
      rejected.push([name, "filename has no usable characters"]);
      continue;
    }
    if (seen.has(slug)) {
      rejected.push([name, `collides with ${seen.get(slug)} (both become ${slug}.svg)`]);
      continue;
    }

    const raw = await fs.readFile(src, ENCODING);
    const problems = validate(raw);
    if (problems.length) {
      rejected.push([name, problems.join("; ")]);
      continue;
    }

    const destName = `${slug}.svg`;
    const dest = path.join(outDir, destName);
    const exists = await fs.stat(dest).then(() => true).catch(() => false);
    if (exists && !force) {
      rejected.push([name, `${destName} already exists (pass --force to replace)`]);
      continue;
    }

    seen.set(slug, name);

    const { data } = optimize(raw, svgoConfig);
    const before = Buffer.byteLength(raw, ENCODING);
    const after = Buffer.byteLength(data, ENCODING);
    const savings = (((before - after) / before) * 100).toFixed(1);

    if (!dryRun) {
      await fs.writeFile(dest, data, ENCODING);
      if (!keep) await fs.rm(src);
    }

    accepted.push(destName);
    const rename = name === destName ? "" : `  (renamed from ${name})`;
    console.log(`✔ ${destName} (${(after / 1024).toFixed(2)} KB, -${savings}%)${exists ? " [replaced]" : ""}${rename}`);
  }

  for (const [name, reason] of rejected) console.warn(`✘ ${name}: ${reason}`);

  if (accepted.length) {
    console.log(`\nStaged ${accepted.length} icon(s) into ${display(outDir)}/${dryRun ? " (dry run, nothing written)" : ""}`);
    if (!dryRun) console.log(`Next: run \`make artifacts\` to regenerate the sprite and kit sheet.`);
  }

  if (rejected.length) {
    console.error(`\n${rejected.length} file(s) rejected.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
