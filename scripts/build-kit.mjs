#!/usr/bin/env node
/**
 * build-kit.mjs (v4.5)
 *
 * FIX: First-row top padding now consistent. Uses explicit outer margins:
 *   marginTop, marginRight, marginBottom, marginLeft (default = --pad)
 *
 * Keeps:
 *  - <image> embedding (data URI)
 *  - Clean names (no "ag--")
 *  - Icon+text centered inside each row's effective height (equal top/bottom inside the row)
 *  - Text centered under icon with 4px total gap (2px base + 2px extra)
 *  - Row shrink (tighter rows) + optional grid outlines
 */

import fs from 'fs/promises';
import path from 'path';
import process from 'process';

function parseArgs(argv) {
  const args = Object.create(null);
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    args[k] = v;
  }
  return args;
}

function kebabBase(filePath) {
  const base = path.basename(filePath, '.svg');
  return base
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function cleanForDisplay(base) {
  return base
    .replace(/\bicon\b/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function getIntrinsicSize(svg) {
  const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (vb) {
    const [x, y, w, h] = vb[1].trim().split(/\s+/).map(Number);
    if ([w, h].every(n => Number.isFinite(n) && n > 0)) return { w, h };
  }
  const wM = svg.match(/\bwidth\s*=\s*"([^"]+)"/i);
  const hM = svg.match(/\bheight\s*=\s*"([^"]+)"/i);
  const toPx = v => {
    if (!v) return null;
    const m = String(v).trim().match(/^([0-9]*\.?[0-9]+)(px|pt|mm|cm|in)?$/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = (m[2] || 'px').toLowerCase();
    const DPI = 96;
    const map = { px: 1, pt: 96/72, in: DPI, cm: DPI/2.54, mm: DPI/25.4 };
    return n * (map[unit] || 1);
  };
  const w = toPx(wM?.[1]);
  const h = toPx(hM?.[1]);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h };
  return { w: 100, h: 100 };
}

function escapeXml(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
  const a = parseArgs(process.argv);
  if (!a.dir) {
    console.error('Error: --dir is required');
    process.exit(1);
  }

  // Core layout
  const cols      = Math.max(1, parseInt(a.cols ?? '8', 10));
  const pad       = Math.max(0, parseInt(a.pad ?? '2', 10));    // gap between cells
  const cellSize  = Math.max(40, parseInt(a.cell ?? '140', 10)); // square cell width
  const labelH    = Math.max(10, parseInt(a.label ?? '20', 10));
  const iconLong  = Math.max(8, parseInt(a['icon-long'] ?? a.icon ?? '104', 10));
  const rowShrink = Math.min(1, Math.max(0.3, parseFloat(a['row-shrink'] ?? '0.75'))); // vertical shrink factor
  const outFile   = a.out ?? 'svg-gallery.svg';

  // Explicit outer margins (fixes first-row top padding)
  const marginTop    = Math.max(0, parseInt(a['margin-top']    ?? String(pad), 10));
  const marginRight  = Math.max(0, parseInt(a['margin-right']  ?? String(pad), 10));
  const marginBottom = Math.max(0, parseInt(a['margin-bottom'] ?? String(pad), 10));
  const marginLeft   = Math.max(0, parseInt(a['margin-left']   ?? String(pad), 10));

  // Grid outline options
  const showGrid   = !!a.grid;
  const gridColor  = a['grid-color']  ?? '#cccccc';
  const gridWidth  = Math.max(0.25, parseFloat(a['grid-width'] ?? '1'));
  const gridOpacity= Math.min(1, Math.max(0, parseFloat(a['grid-opacity'] ?? '0.5')));
  const gridRadius = Math.max(0, parseFloat(a['grid-radius'] ?? '6'));
  const gridDash   = a['grid-dash'];

  // Read SVGs
  const entries = await fs.readdir(a.dir, { withFileTypes: true });
  const paths = entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.svg'))
    .map(e => path.join(a.dir, e.name))
    .filter(p => path.basename(p) !== path.basename(outFile));

  if (!paths.length) {
    console.error('No SVG files found in', a.dir);
    process.exit(1);
  }

  const icons = [];
  for (const p of paths) {
    const raw = await fs.readFile(p, 'utf8');
    const base = kebabBase(p);
    const cleaned = cleanForDisplay(base);
    const name = `${cleaned}`; // never "ag--"
    const { w: iw, h: ih } = getIntrinsicSize(raw);
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
    icons.push({ path: p, name, dataUri, iw, ih });
  }

  // Typography & sizing inside each row
  const fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
  const fontSize   = Math.max(9, Math.floor(labelH * 0.55));

  // Effective row height (used consistently for placement & total height)
  const effH   = cellSize * rowShrink;
  const rows   = Math.ceil(icons.length / cols);

  // Sheet dimensions using explicit margins
  const contentW = cols * cellSize + (cols - 1) * pad;
  const contentH = rows * effH     + (rows - 1) * pad;
  const width    = marginLeft + contentW + marginRight;
  const height   = marginTop  + contentH + marginBottom;

  // Icon long-side target that fits within effH with label + 4px gap
  const iconTarget = Math.max(8, Math.min(iconLong, effH - 4 - labelH));

  const items = icons.map((f, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Cell origin (top-left) with explicit margins
    const cellX = marginLeft + col * (cellSize + pad);
    const cellY = marginTop  + row * (effH + pad);

    // Scale icon to target long side
    const longSide = Math.max(f.iw, f.ih);
    const scale = iconTarget / longSide;
    const iconW = f.iw * scale;
    const iconH = f.ih * scale;

    // Vertically center (icon + 4px + label) within effH
    const groupH = iconH + 4 + labelH;
    const groupTop = cellY + Math.max(0, (effH - groupH) / 2);

    // Icon position
    const iconLeft = cellX + (cellSize - iconW) / 2;
    const iconTop  = groupTop;

    // Label position: 4px below icon, centered
    const labelX = cellX + cellSize / 2;
    const labelY = iconTop + iconH + 4;

    // Optional visible outline using effH
    const rect = showGrid
      ? `<rect x="${cellX.toFixed(2)}" y="${cellY.toFixed(2)}"
               width="${cellSize}" height="${effH.toFixed(2)}"
               rx="${gridRadius}" ry="${gridRadius}"
               fill="none"
               stroke="${escapeXml(gridColor)}"
               stroke-width="${gridWidth}"
               ${gridDash ? `stroke-dasharray="${escapeXml(gridDash)}"` : ''}
               opacity="${gridOpacity}"/>`
      : '';

    return `
      <g>
        ${rect}
        <image href="${f.dataUri}"
               x="${iconLeft.toFixed(2)}" y="${iconTop.toFixed(2)}"
               width="${iconW.toFixed(2)}" height="${iconH.toFixed(2)}"
               preserveAspectRatio="xMidYMid meet" />
        <text x="${labelX.toFixed(2)}" y="${labelY.toFixed(2)}"
              text-anchor="middle" dominant-baseline="hanging"
              font-family="${fontFamily}" font-size="${fontSize}">
          ${escapeXml(f.name)}
        </text>
      </g>`;
  }).join('\n');

  const svgOut = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  ${items}
</svg>`.replace(/\n\s+\n/g, '\n');

  await fs.writeFile(outFile, svgOut, 'utf8');
  console.log(`✅ Gallery created: ${outFile}`);
  console.log(`   Size: ${width}×${height} | cols=${cols}, rows=${rows}, cell=${cellSize}, effH=${effH.toFixed(2)}, pad=${pad}`);
  console.log(`   Margins: top=${marginTop}, right=${marginRight}, bottom=${marginBottom}, left=${marginLeft}`);
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1); });
