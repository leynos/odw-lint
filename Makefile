.PHONY: help all clean build lint fmt check-fmt typecheck test markdownlint

.DEFAULT_GOAL := all

all: build check-fmt lint typecheck test

node_modules: package.json
	bun install
	@touch node_modules

build: node_modules ## Install dependencies

clean: ## Remove build artifacts
	rm -rf dist node_modules .bun

fmt: build ## Format sources
	bun run fmt

check-fmt: build ## Verify formatting
	bunx biome check --formatter-enabled=true --linter-enabled=false src tests

lint: build ## Run linters
	bun run lint

typecheck: build ## Run type checking
	bun run check:types

test: build ## Run tests
	bun test

markdownlint: ## Lint Markdown files
	bunx markdownlint-cli2 '**/*.md'

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | \
	sed 's/:.*##/##/' | \
	awk 'BEGIN {FS="##"; printf "Available targets:\n"} {gsub(/^[ \t]+/, "", $$2); printf "  %-20s %s\n", $$1, $$2}'
