#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { optimize } from "svgo";

const ENCODING = "utf8";

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const inputDirRaw = getArg("--input");
const outputDirRaw = getArg("--output");

if (!inputDirRaw || !outputDirRaw) {
  console.error("Usage: node optimize-svgs.mjs --input <dir> --output <dir>");
  process.exit(1);
}

const inputDir = path.resolve(process.cwd(), inputDirRaw);
const outputDir = path.resolve(process.cwd(), outputDirRaw);

const svgoConfig = {
  multipass: true,
  js2svg: { indent: 0, pretty: false },
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          removeComments: { preservePatterns: [] },
          cleanupNumericValues: { floatPrecision: 3 },
          convertPathData: { floatPrecision: 3 },
        },
      },
    },
    "removeViewBox",
    "removeXMLProcInst",
    "removeDoctype",
    "sortAttrs",
    { name: "cleanupIds", params: { minify: true } },
  ],
};

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) yield full;
  }
}

(async () => {
  const stat = await fs.stat(inputDir).catch(() => null);
  if (!stat?.isDirectory()) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  let count = 0;
  const start = Date.now();

  for await (const svgPath of walk(inputDir)) {
    const relPath = path.relative(inputDir, svgPath);
    const outPath = path.join(outputDir, relPath);

    try {
      const svg = await fs.readFile(svgPath, ENCODING);
      const result = optimize(svg, svgoConfig);

      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, result.data, ENCODING);
      const originalSize = Buffer.byteLength(svg, ENCODING);
      const newSize = Buffer.byteLength(result.data, ENCODING);
      const savings = (((originalSize - newSize) / originalSize) * 100).toFixed(1);
      console.log(`✔ ${relPath} (${(newSize / 1024).toFixed(2)} KB, -${savings}%)`);
      count++;
    } catch (e) {
      console.warn(`✘ ${relPath}: ${e.message}`);
    }
  }

  console.log(`Done: ${count} files in ${Date.now() - start}ms`);
})();
