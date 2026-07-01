.PHONY: help all clean build lint biomejs oxlint fmt check-fmt typecheck test refresh-fixtures whitespace-hygiene branch-freshness markdownlint nixie

.DEFAULT_GOAL := all

all: build check-fmt whitespace-hygiene lint typecheck test

node_modules: package.json bun.lock
	bun install
	@touch node_modules

build: node_modules ## Install dependencies

clean: ## Remove build artifacts
	rm -rf dist node_modules .bun

fmt: build ## Format sources
	bun run fmt

check-fmt: build ## Verify formatting
	bunx biome check --formatter-enabled=true --linter-enabled=false src tests package.json biome.jsonc bunfig.toml tsconfig.json .oxlintrc.json

lint: biomejs oxlint ## Run linters

biomejs: build ## Run Biome lint
	bun run lint:biome

oxlint: build ## Run Oxlint
	bun run lint:oxlint

typecheck: build ## Run type checking
	bun run check:types

test: build ## Run tests
	bun test

refresh-fixtures: build ## Refresh workflow fixture metadata
	bun run tests/static-analysis/fixtures/refresh-metadata.ts

whitespace-hygiene: ## Check tracked files for trailing whitespace
	bun run tests/build-gate/whitespace-hygiene.ts

branch-freshness: ## Check roadmap task branch freshness
	bun run tests/build-gate/branch-freshness-git.ts

markdownlint: ## Lint Markdown files
	bunx markdownlint-cli2 '**/*.md'

nixie: ## Validate Mermaid diagrams in Markdown files
	nixie --no-sandbox

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	sed 's/:.*##/##/' | \
	awk 'BEGIN {FS="##"; printf "Available targets:\n"} {gsub(/^[ \t]+/, "", $$2); printf "  %-20s %s\n", $$1, $$2}'
