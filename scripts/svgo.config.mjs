// Single source of truth for SVG optimization.
// Both the stage intake (stage-icons.mjs) and the bulk optimizer
// (optimize-svgs.mjs) import this, so generated artifacts stay reproducible.

// The kit is 1-bit, so every icon ships uncolored and inherits the consumer's
// CSS `color`. Without this the paths fall back to SVG's initial fill (black),
// which is why the set only ever worked on a light background.
const setRootFill = {
  name: "setRootFill",
  fn: () => ({
    element: {
      enter(node, parentNode) {
        if (node.name === "svg" && parentNode.type === "root") {
          node.attributes.fill ??= "currentColor";
        }
      },
    },
  }),
};

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
    setRootFill,
    "sortAttrs",
    { name: "cleanupIds", params: { minify: true } },
  ],
};
