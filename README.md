# Analog Gothic [![npm](https://img.shields.io/npm/v/analog-gothic)](https://www.npmjs.com/package/analog-gothic) [![CI](https://github.com/hastefuI/analog-gothic/actions/workflows/ci.yml/badge.svg)](https://github.com/hastefuI/analog-gothic/actions/workflows/ci.yml) [![Release](https://img.shields.io/github/v/release/hastefuI/analog-gothic)](https://github.com/hastefuI/analog-gothic/releases) [![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/hastefuI/analog-gothic/blob/main/LICENSE)

Analog Gothic is a free, open-source 1-bit pixel icon kit inspired by medieval symbolism and nature. 🗝️

## Kit

<img src="./analog-gothic-kit.svg" style="background:#fff;">

## Overview

This icon kit embraces intentional simplicity, combining both filled and outlined pixel icons within the same set.

All icons in this kit are pure SVGs, allowing flexibility across a wide range of use cases:
- Standalone icons using `<img>`
- SVG sprite references
- Inline SVG (copy-paste directly into markup)

## Install

```bash
$ npm install analog-gothic
```

Analog Gothic ships plain SVG files and no JavaScript entry point. Reference
them however suits your setup.

With a build tool, resolve the package by name:

```js
import bookIcon from "analog-gothic/icons/ag-book.svg"
```

```css
.ag-icon-book {
  background-image: url("analog-gothic/icons/ag-book.svg");
}
```

Vite and Parcel support this out of the box. webpack needs an `asset/resource`
rule for `.svg`, and esbuild needs `--loader:.svg=file`.

Without a build step, load from a CDN:

```html
<img src="https://cdn.jsdelivr.net/npm/analog-gothic@1/icons/ag-book.svg" alt="ag-book" />
```

Or copy the set into your project:

```bash
$ cp -r node_modules/analog-gothic/icons public/icons
```

## Usage

These examples serve icons from a local `icons/` directory. Swap the path for
a package specifier or a CDN URL to match your setup.

Standalone icon:
```html
<img class="ag-icon ag-icon-book" src="icons/ag-book.svg" alt="ag-book" />
```

SVG sprite:
```html
<div id="ag-sprite" style="display:none">
    <!-- Replace with analog-gothic.svg sprite contents here -->
</div>
<svg class="ag-icon ag-icon-book" width="48" height="48" aria-hidden="true">
  <use href="#ag-book" />
</svg>
```

Inline SVG:
```html
<!-- Inline SVG usage -->
<svg class="ag-icon ag-icon-book" fill="currentColor" viewBox="0 0 64 64" aria-hidden="true">
  ...
</svg>
```

## Development

Requires Node.js 24+ and `make`. Run `make` to list every target.

```bash
$ make install     # install dependencies from the lockfile
$ make add         # normalize + optimize stage/*.svg into icons/
$ make artifacts   # regenerate analog-gothic.svg and analog-gothic-kit.svg
$ make verify      # fail if the committed artifacts are stale
$ make preview     # build dist/ and open it in a browser
```

Using Docker:

```bash
$ make docker-image    # build the image once
$ make docker-build    # optimize icons/ and regenerate artifacts
$ make docker-verify   # confirm the committed artifacts are in sync
$ make docker-preview  # live-reload preview on http://localhost:3000
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full icon workflow and
release process.

## Releases

Analog Gothic is maintained under [semantic versioning guidelines](https://semver.org).

What to expect when making use of this icon kit:
* A `major` release may add, remove, modify, or rename icons
* A `minor` release will be reserved for general improvements and may add icons
* A `patch` release will be reserved for bug fixes

## License

Licensed under [MIT License](https://opensource.org/licenses/MIT), see [LICENSE](./LICENSE) for details.

Copyright (c) 2026 hasteful.
