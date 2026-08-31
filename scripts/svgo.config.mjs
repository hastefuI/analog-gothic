// Single source of truth for SVG optimization.
// Both the stage intake (stage-icons.mjs) and the bulk optimizer
// (optimize-svgs.mjs) import this, so generated artifacts stay reproducible.
export const svgoConfig = {
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
