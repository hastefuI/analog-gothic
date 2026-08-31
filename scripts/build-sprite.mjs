#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const RECURSIVE = false;

function arg(flag, fallback = undefined) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function loadTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, name);
  return fs.readFile(filePath, 'utf8');
}

function interpolate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function listSvgs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (RECURSIVE) files.push(...(await listSvgs(full)));
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.svg')) {
      files.push(full);
    }
  }
  return files.sort();
}

function sanitizeSlug(name) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractSvgParts(svg) {
  svg = svg
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .trim();

  const openTagMatch = svg.match(/<svg\b([^>]*)>/i);
  const closeIdx = svg.lastIndexOf('</svg>');
  if (!openTagMatch || closeIdx === -1) throw new Error('Invalid SVG: missing <svg> wrapper.');

  const openAttrs = openTagMatch[1] || '';
  let inner = svg.slice(openTagMatch[0].length, closeIdx).trim();

  inner = inner.replace(/<title[\s\S]*?<\/title>/gi, '').replace(/<desc[\s\S]*?<\/desc>/gi, '');

  const viewBoxMatch = openAttrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const widthMatch = openAttrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
  const heightMatch = openAttrs.match(/\bheight\s*=\s*["']([^"']+)["']/i);

  let viewBox = viewBoxMatch ? viewBoxMatch[1] : null;
  if (!viewBox) {
    const w = widthMatch ? parseFloat(widthMatch[1]) : NaN;
    const h = heightMatch ? parseFloat(heightMatch[1]) : NaN;
    viewBox = Number.isFinite(w) && Number.isFinite(h) ? `0 0 ${w} ${h}` : '0 0 24 24';
  }

  // Only viewBox and fill survive onto the <symbol>. fill carries the source's
  // `currentColor`, without which sprited icons would fall back to black.
  const fillMatch = openAttrs.match(/\bfill\s*=\s*["']([^"']+)["']/i);
  const fill = fillMatch ? fillMatch[1] : null;

  return { inner, viewBox, fill };
}

function ensureUniqueIds(base, existing) {
  let id = base;
  let n = 2;
  while (existing.has(id)) id = `${base}-${n++}`;
  existing.add(id);
  return id;
}

async function build(inDir, outDir, spriteName) {
  await fs.mkdir(outDir, { recursive: true });

  const files = await listSvgs(inDir);
  if (files.length === 0) {
    console.error(`No SVGs found in ${inDir}`);
    return false;
  }

  const usedIds = new Set();
  const symbols = [];
  const manifest = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf8');
    const baseName = sanitizeSlug(path.basename(file));
    const id = ensureUniqueIds(baseName, usedIds);

    try {
      const { inner, viewBox, fill } = extractSvgParts(raw);
      const cleanedInner = inner.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
      const fillAttr = fill ? ` fill="${fill}"` : '';
      symbols.push(`<symbol id="${id}" viewBox="${viewBox}"${fillAttr}>${cleanedInner}</symbol>`);
      manifest.push({ id, name: baseName, file: path.basename(file), viewBox });
    } catch (err) {
      console.warn(`Skipping ${file}: ${err.message}`);
    }
  }

  const spriteContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true">
${symbols.join('\n')}
</svg>`;

  const [cssTemplate, htmlTemplate, readmeTemplate, cardTemplate] = await Promise.all([
    loadTemplate('sprite-preview.css'),
    loadTemplate('sprite-preview.html'),
    loadTemplate('sprite-readme.md'),
    loadTemplate('icon-card.html'),
  ]);

  const iconListHtml = manifest
    .map((m) => interpolate(cardTemplate, { ID: m.id, NAME: m.name }))
    .join('\n');

  const html = interpolate(htmlTemplate, {
    SPRITE_NAME: spriteName,
    SPRITE_CONTENT: spriteContent,
    ICON_LIST: iconListHtml,
  });

  const spritePath = path.join(outDir, spriteName);

  await Promise.all([
    fs.writeFile(spritePath, spriteContent, 'utf8'),
    fs.writeFile(path.join(outDir, 'styles.css'), cssTemplate, 'utf8'),
    fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8'),
    fs.writeFile(path.join(outDir, 'README.md'), readmeTemplate, 'utf8'),
  ]);

  console.log(`Sprited ${symbols.length} icons`);
  console.log(`Output: ${spritePath}`);
  console.log(`Demo: ${path.join(outDir, 'index.html')}`);

  return true;
}

async function watch(inDir, outDir, spriteName) {
  console.log(`Watching ${inDir} for changes...`);

  let debounceTimer = null;
  const rebuild = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.log('\nRebuilding...');
      await build(inDir, outDir, spriteName);
    }, 100);
  };

  const watcher = fs.watch(inDir, { recursive: RECURSIVE });
  for await (const event of watcher) {
    if (event.filename?.toLowerCase().endsWith('.svg')) {
      rebuild();
    }
  }
}

async function main() {
  const inDir = arg('--in', './svg');
  const outDir = arg('--out', './dist');
  const spriteName = arg('--sprite-name', 'sprite.svg');
  const watchMode = hasFlag('--watch') || hasFlag('-w');

  try {
    const stat = await fs.stat(inDir);
    if (!stat.isDirectory()) {
      console.error(`--in must be a directory. Got: ${inDir}`);
      process.exit(1);
    }
  } catch {
    console.error(`Input directory not found: ${inDir}`);
    process.exit(1);
  }

  const success = await build(inDir, outDir, spriteName);
  if (!success) process.exit(1);

  if (watchMode) {
    await watch(inDir, outDir, spriteName);
  }
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
