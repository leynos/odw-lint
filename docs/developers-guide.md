# Developers' Guide

This repository uses Bun for package scripts and TypeScript execution. Prefer
the Makefile targets below when validating changes so local runs match the
commit gate.

## Static-Analysis Boundary

`odw-lint` checks workflow source before any workflow runs, so the
static-analysis boundary is also a security boundary. Production code must not
call ODW runtime helpers that evaluate metadata, compile workflow bodies, start
runs, or dispatch agents.

The v1 command boundary is the standalone `odw-lint check` command. An
ODW-integrated `odw check` command is deferred to future ODW integration. The
standalone checker is path/glob-first and does not resolve bare ODW workflow
names by default.

The first implementation owns the static-analysis implementation inside this
repository. v1 vendors the pure-literal parser behaviour from ODW's
`dual-compat.ts` into `odw-lint` as its own source of truth, and production
code must not depend on ODW publishing a static API.

The owned production boundary starts at `src/static-analysis/`. The package
remains private, but `package.json` now pins `main`, `types`, and the default
package export to `./src/index.ts`; it also exports `./package.json`. There is
still no published `bin` field while the command surface is being built.

Treat `src/index.ts` as the current private package entry. It re-exports the
diagnostic contract and the static-analysis source helpers that downstream
parser, mapper, and reporter code may consume through `odw-lint`. It must stay
free of executable ODW runtime imports and should expose package-level
contracts only through explicit named re-exports.

The scaffold is deliberately passive. It exports the boundary identifier,
workflow source shape, component labels, and stage labels, but it does not
parse workflow bodies or emit diagnostics. Direct SWC calls belong only in the
future parser adapter from roadmap task 2.2.1. Task 1.1.1 also deliberately
does not add `@swc/core`, `parseWithSwc`, a public parser failure contract, or
the forbidden-import architecture test.

When extending this area, keep the roadmap sequencing intact: task 2.1.4 owns
the forbidden-import architecture test for production code, and task 2.2.1 owns
the SWC parser adapter.

## Commit Gate

Run the full gate before committing code changes:

```sh
make all
```

`make all` runs the following targets in order:

- `make build`
- `make check-fmt`
- `make lint`
- `make typecheck`
- `make test`

`make build` installs dependencies through the `node_modules` Make target. That
marker depends on both `package.json` and `bun.lock`, so a lockfile-only
dependency update is expected to rerun `bun install` before formatting,
linting, type checking, or tests use the installed toolchain.

Run `make markdownlint` as well when Markdown files change.

## Bun Scripts

The Makefile delegates TypeScript tooling to Bun package scripts:

- `bun run fmt` applies Biome formatting to source, tests, and project
  configuration files.
- `bun run lint:biome` runs Biome linting over `src` and `tests`.
- `bun run lint:oxlint` runs Oxlint over `src` and `tests`.
- `bun run check:types` runs `bunx tsc --noEmit`.
- `bun test` runs the Bun test suite.

Use `bunx` for one-off local CLIs so the project can resolve repository-local
tooling before falling back to package resolution.

## Formatting

Use `make check-fmt` to verify formatting without rewriting files. It runs
Biome with formatting enabled and linting disabled across:

- `src`
- `tests`
- `package.json`
- `biome.jsonc`
- `bunfig.toml`
- `tsconfig.json`
- `.oxlintrc.json`

Use `make fmt` when formatting changes need to be applied.

## Linting

Use `make lint` for the complete lint gate. It runs both Biome and Oxlint:

- `make biomejs` runs `bun run lint:biome`.
- `make oxlint` runs `bun run lint:oxlint`.

Biome enforces the recommended TypeScript lint rules configured in
`biome.jsonc`. Oxlint loads the `df12-lints` plugin and enforces the local
maintainability rules configured in `.oxlintrc.json`, including complexity,
nesting depth, complex-conditionals, and required module, public, and private
JSDoc.

Fix lint findings in the code rather than suppressing them. Suppressions are a
last resort, must be tightly scoped, and must include the reason they are
necessary.

## Type Checking

Use `make typecheck` to run the TypeScript compiler without emitting files. The
target delegates to `bun run check:types`, which uses:

```sh
bunx tsc --noEmit
```

Keep `tsconfig.json` strict. Avoid weakening compiler settings to make a change
pass; prefer narrowing types, modelling domain values explicitly, or validating
unknown input at the boundary.

## Tests

Use `make test` to run the Bun test suite. Add or update tests when behaviour
changes, and cover happy paths, unhappy paths, and relevant edge cases.

The Bun suite includes a package export-surface guard in
`tests/diagnostics/public-api-surface.test.ts`. Intentional public API changes
to the package entry must update that file's reviewed
`EXPECTED_PUBLIC_PACKAGE_EXPORTS` list in the same change, so accidental
removals from `src/index.ts` fail the default repository gate.

Behavioural tests should use `@aboviq/bun-test-cucumber` with Gherkin feature
files. Snapshot tests should use Bun's built-in snapshot testing support.
Property tests should use `fast-check`, and exhaustive bounded proofs should use
`lemmascript` where a proof is the right level of rigour.

### Workflow Fixture Corpus

ODW example workflow snapshots live under
`tests/static-analysis/fixtures/odw-examples/`. Refresh them from the
source-backed sibling checkout identified by `ODW_REFERENCE_CHECKOUT`; do not
record host-specific absolute paths in committed documentation or manifests.

The copied `.js` snapshots are intentionally excluded from Biome and Oxlint so
their source stays byte-for-byte identical to upstream ODW examples. Do not
format or rewrite those files in this repository. Update
`tests/static-analysis/fixtures/odw-examples.ts` when refreshing the corpus so
the manifest records the new hashes and the expected `no-error` diagnostics.

Invalid workflow fixtures live under
`tests/static-analysis/fixtures/invalid-workflows/`. They are deliberately raw
inputs for missing metadata, malformed metadata, unsupported import/export, and
syntax-error coverage. The `hostile-metadata` family is also raw invalid input:
its metadata expressions would set or throw visible marker values if evaluated.
Do not import, evaluate, execute, or format invalid workflow fixtures as
ordinary JavaScript. Keep `tests/static-analysis/fixtures/invalid-workflows.ts`
in sync with every raw fixture by updating the family, path, SHA-256 hash,
expected status, diagnostic rule, severity, message, UTF-8 source span, and
reviewer-facing `spanText`.

Synthetic masking fixtures live under
`tests/static-analysis/fixtures/masking/`. They are owned by `odw-lint`, not
copied from upstream ODW, so repository tooling may format them like ordinary
test source. Keep their manifest in `tests/static-analysis/fixtures/masking.ts`
sorted by filename and pin each fixture's SHA-256 hash after formatting. These
fixtures record empty `no-envelope-diagnostics` expectations for future
envelope-scanner work where decoy workflow syntax appears inside comments,
strings, regex literals, and template literals.

Loader-parity execution remains owned by roadmap task 2.3.1. The fixture corpus
records trusted source snapshots and static expectations only; it must not
import, evaluate or execute workflow bodies during ordinary tests. Roadmap task
2.1.5 owns the future no-side-effect lint execution regression for hostile
metadata fixtures.

### Source-span helpers

Build source-span data from the original, pre-normalized workflow source with
`createOriginalSourceFile`. Parser, mapper, and reporter code must pass that
factory-created record through the pipeline instead of reconstructing
`OriginalSourceFile` objects structurally, because the helper stores private
offset indexes alongside the public line metadata.

Offsets are zero-based UTF-8 byte offsets into the original source text. Lines
and columns are one-based display positions, and columns count Unicode code
points rather than UTF-16 code units. Source-span helpers treat LF, CR, CRLF,
U+2028 line separator, and U+2029 paragraph separator as JavaScript line
terminators. A CRLF terminator counts as one display line break, but it still
occupies two UTF-8 byte offsets; the offset between the carriage return and line
feed is not a valid display position. The Unicode separators each occupy three
UTF-8 byte offsets, and interior bytes are not valid display positions.

Use `spanFromOffsets(file, startOffset, endOffset)` for half-open spans where
`startOffset` is inclusive and `endOffset` is exclusive. Use `sliceSourceSpan`
or `snippetForSpan` only after the span has been validated against the same
`OriginalSourceFile`; both helpers re-check caller-supplied spans so stale
line, column, or offset data cannot produce misleading text.

Internal source-helper ownership is split by responsibility:

- `src/static-analysis/source-file.ts` creates `OriginalSourceFile` records and
  re-exports the public source-span helpers as the compatibility facade.
- `src/static-analysis/source-scan.ts` performs the single production scan over
  original source text, building line metadata, display positions, UTF-8 byte
  offsets, and UTF-16 text indexes.
- `src/static-analysis/source-indexes.ts` owns private index storage and
  guarded lookup for factory-created source records.
- `src/static-analysis/source-position.ts` owns offset lookup, span
  construction, and caller-supplied span validation.
- `src/static-analysis/source-snippet.ts` owns validated source slicing and
  reviewer-facing snippets.

Keep new parser, mapper, and reporter code on the public facade unless it needs
an explicitly internal helper. Do not re-export private index or validation
helpers from `src/static-analysis/index.ts` or `src/index.ts` without a design
update.

```ts
import { createOriginalSourceFile, sliceSourceSpan, spanFromOffsets } from "odw-lint";

const file = createOriginalSourceFile({
  filePath: "workflows/example.js",
  sourceText: "meta\r\nbody",
});
const bodySpan = spanFromOffsets(file, 6, 10);

sliceSourceSpan(file, bodySpan); // "body"
```

## Markdown

Use `make markdownlint` when Markdown files change. The target runs:

```sh
bunx markdownlint-cli2 '**/*.md'
```

Keep paragraphs and bullet points wrapped at 80 columns, code blocks wrapped at
120 columns, and use dashes for list bullets.

## Documentation Upkeep

Keep the design documents aligned when changing static-analysis scope:

- update [ADR 0001](adr/0001-static-analysis-boundary.md) when the ownership
  boundary changes;
- update [technical-design.md](technical-design.md) when command, diagnostic,
  parser, configuration, or verification contracts change;
- update [roadmap.md](roadmap.md) when a planned task is completed or
  re-scoped; and
- avoid host-specific absolute paths in committed documentation.
