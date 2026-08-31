# Contributing to Analog Gothic

Looking to contribute something to Analog Gothic?

## Quick Start

* [Request a new icon](https://github.com/hastefuI/analog-gothic/issues/new?title=Icon%20request:%20icon-name&template=icon-request.md)
* [Request a new feature](https://github.com/hastefuI/analog-gothic/issues/new?title=Feature%20request:%20feature-name&template=feature-request.md)
* [Submit a bug report](https://github.com/hastefuI/analog-gothic/issues/new?template=bug-report.md)

When reporting a bug, ensure steps to reproduce the issue are included.

## Key Branches

- `main` is the latest, deployed version

## Pull requests

- At the moment we are not accepting pull requests containing icons
- Pull requests that do not solve an existing issue are essentially un-prioritized, so don't expect these to be addressed quickly
- Try not to pollute your pull request with unintended changes, and keep them simple and small
- Try to share which browsers your code has been tested in before submitting a pull request

## Build requirements

- Node.js 24 or newer
- `make`

Install dependencies from the lockfile:

```sh
make install
```

Run `make` on its own to list every available target.

## Adding an icon

Icons travel in one direction: `stage/` → `icons/` → published artifacts.

1. Drop the raw `.svg` files into `stage/`. Filenames do not need to follow
   any convention yet.
2. Run the intake step:

   ```sh
   make add
   ```

   Each file is renamed to the kit's `ag-<name>.svg` convention, validated,
   optimized with [SVGO](https://github.com/svg/svgo), and moved into
   `icons/`. Accepted files are removed from `stage/`, and rejected ones stay put
   with the reason printed.

   An icon is rejected if it has no `<svg>` wrapper, has no `viewBox` (and no
   `width`/`height` to derive one from), contains `<script>` or
   `<foreignObject>`, carries an inline event handler attribute, or would
   overwrite an existing icon. Pass `--force` to replace deliberately:

   ```sh
   node scripts/stage-icons.mjs --in stage --out icons --force
   ```

3. Regenerate the published artifacts:

   ```sh
   make artifacts
   ```

   This rebuilds `analog-gothic.svg` (the sprite) and `analog-gothic-kit.svg`
   (the contact sheet), and refreshes the `dist/` preview.

4. Confirm everything is in sync before committing:

   ```sh
   make verify
   ```

5. Preview the result in a browser:

   ```sh
   make preview
   ```

Commit the new `icons/*.svg` together with both regenerated root SVGs. They
are generated files, but they are tracked deliberately so the kit can be used
straight from the repository.

## Generated artifacts

| Path                    | Built from | Built by                |
| ----------------------- | ---------- | ----------------------- |
| `icons/*.svg`           | `stage/`   | `scripts/stage-icons.mjs` |
| `analog-gothic.svg`     | `icons/`   | `scripts/build-sprite.mjs` |
| `analog-gothic-kit.svg` | `icons/`   | `scripts/build-kit.mjs` |
| `dist/`                 | `icons/`   | `scripts/build-sprite.mjs` |

`dist/` is a local preview and is not committed.

The contact sheet's layout (`KIT_COLS`, `KIT_PAD`, `KIT_LABEL`,
`KIT_ICON_LONG`) is pinned in the `Makefile`. Those values reproduce the
published sheet exactly. Changing one changes the published artwork, so treat
them as versioned input rather than incidental defaults.

`make verify` regenerates everything into a temporary directory and fails if a
committed artifact differs. CI runs it on every push and pull request, so a
stale sprite or an unoptimized icon fails the build rather than reaching a
release.

## Releases

Analog Gothic is maintained under [semantic versioning guidelines](https://semver.org).

Cut a release from a clean `main`:

```sh
make release VERSION=1.2.0
git push origin main --follow-tags
```

`make release` rebuilds every artifact, verifies it is in sync, sets the
version in `package.json`, then creates a signed commit and a signed tag. It
refuses to run if the working tree is dirty or no signing key is configured.

Pushing the tag triggers the release workflow, which re-verifies the
artifacts, publishes to npm with provenance, and creates the GitHub release
with both SVGs attached.
