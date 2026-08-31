# Analog Gothic - icon kit build and release flow.
#
# Adding an icon:
#   1. drop raw .svg files into stage/
#   2. make add         normalize, validate and optimize them into icons/
#   3. make artifacts   regenerate the sprite and the kit sheet
#   4. make verify      confirm the committed artifacts match icons/
#
# Cutting a release:
#   make release VERSION=1.2.0   then push, and CI publishes.

NODE ?= node
NPM  ?= npm

# Extra flags for `npm publish`. CI passes --provenance.
NPM_FLAGS ?=

STAGE_DIR ?= stage
ICONS_DIR ?= icons
DIST_DIR  ?= dist

SPRITE ?= analog-gothic.svg
KIT    ?= analog-gothic-kit.svg

# Kit sheet layout. These values reproduce the published sheet byte-for-byte.
# Changing any of them changes the artwork, so treat them as versioned input
# rather than incidental defaults.
KIT_COLS      ?= 7
KIT_PAD       ?= 1
KIT_LABEL     ?= 24
KIT_ICON_LONG ?= 48

# Commit and tag signing. Override with: make release VERSION=x SIGNING_KEY=<keyid>
SIGNING_KEY ?= $(shell git config --get user.signingkey)
GIT_SIGN     = $(if $(SIGNING_KEY),-c user.signingkey=$(SIGNING_KEY) -c gpg.format=openpgp,)

.DEFAULT_GOAL := help
.PHONY: help install add optimize sprite kit artifacts build preview verify clean release publish check-signing check-clean

help: ## Show available targets
	@printf 'Analog Gothic\n\n'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies from the lockfile
	$(NPM) ci

add: ## Normalize, validate and optimize stage/*.svg into icons/
	$(NODE) scripts/stage-icons.mjs --in $(STAGE_DIR) --out $(ICONS_DIR)

optimize: ## Re-run svgo over icons/ in place (idempotent)
	$(NODE) scripts/optimize-svgs.mjs --input $(ICONS_DIR) --output $(ICONS_DIR)

sprite: ## Build the SVG sprite and the dist/ preview
	$(NODE) scripts/build-sprite.mjs --in $(ICONS_DIR) --out $(DIST_DIR) --sprite-name $(SPRITE)
	cp $(DIST_DIR)/$(SPRITE) $(SPRITE)

kit: ## Build the kit contact sheet
	$(NODE) scripts/build-kit.mjs --dir $(ICONS_DIR) \
		--cols $(KIT_COLS) --pad $(KIT_PAD) \
		--label $(KIT_LABEL) --icon-long $(KIT_ICON_LONG) \
		--out $(KIT)

artifacts: sprite kit ## Regenerate both published SVGs and the dist/ preview

build: optimize artifacts ## Optimize icons/, then regenerate every artifact

preview: sprite ## Build the dist/ preview and print where to open it
	@echo "Open $(DIST_DIR)/index.html"

verify: ## Fail if the committed artifacts do not match icons/
	@tmp=$$(mktemp -d); \
	trap 'rm -rf "$$tmp"' EXIT; \
	$(NODE) scripts/optimize-svgs.mjs --input $(ICONS_DIR) --output "$$tmp/icons" >/dev/null || exit 1; \
	for f in $(ICONS_DIR)/*.svg; do \
		if ! diff -q "$$tmp/icons/$$(basename $$f)" "$$f" >/dev/null 2>&1; then \
			echo "drift: $$f is not fully optimized - run 'make optimize'"; exit 1; \
		fi; \
	done; \
	$(NODE) scripts/build-sprite.mjs --in $(ICONS_DIR) --out "$$tmp/dist" --sprite-name $(SPRITE) >/dev/null || exit 1; \
	if ! diff -q "$$tmp/dist/$(SPRITE)" $(SPRITE) >/dev/null; then \
		echo "drift: $(SPRITE) is stale - run 'make artifacts'"; exit 1; \
	fi; \
	$(NODE) scripts/build-kit.mjs --dir $(ICONS_DIR) \
		--cols $(KIT_COLS) --pad $(KIT_PAD) \
		--label $(KIT_LABEL) --icon-long $(KIT_ICON_LONG) \
		--out "$$tmp/$(KIT)" >/dev/null || exit 1; \
	if ! diff -q "$$tmp/$(KIT)" $(KIT) >/dev/null; then \
		echo "drift: $(KIT) is stale - run 'make artifacts'"; exit 1; \
	fi; \
	echo "ok: $(SPRITE), $(KIT) and $(ICONS_DIR)/ are in sync"

clean: ## Remove generated preview output
	rm -rf $(DIST_DIR)

check-signing:
	@test -n "$(SIGNING_KEY)" || { \
		echo "No signing key configured."; \
		echo "Set one with: git config user.signingkey <keyid>"; \
		echo "or pass it inline: make release VERSION=x.y.z SIGNING_KEY=<keyid>"; \
		exit 1; }

check-clean:
	@git diff --quiet && git diff --cached --quiet || { \
		echo "Working tree is dirty - commit or stash first."; exit 1; }

release: check-signing check-clean ## Cut a signed release: make release VERSION=1.2.0
	@test -n "$(VERSION)" || { echo "usage: make release VERSION=1.2.0"; exit 1; }
	$(MAKE) build
	$(MAKE) verify
	$(NPM) version $(VERSION) --no-git-tag-version
	git add package.json package-lock.json $(ICONS_DIR) $(SPRITE) $(KIT)
	git $(GIT_SIGN) commit -S -m "chore(release): v$(VERSION)"
	git $(GIT_SIGN) tag -s v$(VERSION) -m "v$(VERSION)"
	@echo
	@echo "Tagged v$(VERSION). Publish with:"
	@echo "  git push origin main --follow-tags"

publish: verify ## Publish to npm (CI uses this; needs NPM_TOKEN)
	$(NPM) publish --access public $(NPM_FLAGS)
