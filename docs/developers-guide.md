# Developers' Guide

This repository uses Bun for package scripts and TypeScript execution. Prefer
the Makefile targets below when validating changes so local runs match the
commit gate. The current diagnostic catalogue is documented in the
[rule reference](rules/index.md).

Start with the [documentation contents](contents.md) when choosing which
maintainer document to open. Use the [repository layout](repository-layout.md)
for path ownership and fixture boundaries, the
[technical design](technical-design.md) for the static-analysis architecture,
and [ADR 0001](adr/0001-static-analysis-boundary.md) for the accepted
non-execution boundary.

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
diagnostic contract, including the reviewed message-template helpers for
parser-backed dynamic diagnostics, and the static-analysis source helpers that
downstream parser, mapper, and reporter code may consume through `odw-lint`. It
must stay free of executable ODW runtime imports and should expose
package-level contracts only through explicit named re-exports.

The first envelope scanner lives in `src/static-analysis/workflow-envelope.ts`.
It extracts `export const meta` from masked source, records metadata value
state, reports missing metadata and unsupported top-level imports or exports,
and exposes source spans in the original source file.

The workflow body parser adapter lives in
`src/static-analysis/workflow-body-parser.ts`. `parseWorkflowBody` normalizes
the scanned `envelope.bodySpan` with `normalizeWorkflowBody`, parses the
normalized text with `@swc/core`'s `parseSync`, and converts observed parser
syntax failures into `odw/body-syntax` diagnostics with original-source spans.
The adapter never executes workflow source, never calls ODW runtime helpers,
and returns a frozen discriminated result instead of letting syntax errors
escape.

`normalizeWorkflowBody` lives in
`src/static-analysis/workflow-body-normalizer.ts`. It wraps the original body
slice verbatim in an injected async function so ODW bodies with top-level
`return` and `await` parse as ordinary JavaScript function bodies. The injected
wrapper is parse-only source text; do not construct a `Function`, call `eval`,
or import ODW runtime loader helpers from this path.

Use `originalSpanFromNormalizedOffsets` when a parser-backed check needs to map
normalized byte offsets back to the original workflow source. Callers subtract
the current SWC program span base first, then pass 0-based normalized byte
offsets to the mapper. The mapper returns validated `SourceSpan` values in
original-source coordinates and rejects ranges that touch injected wrapper text
or run backwards. It deliberately accepts numeric offsets rather than SWC AST
types; workflow AST facts expose derived, parser-type-free data through the
public package surface described below.

### Workflow AST facts

`collectWorkflowAstFacts(envelope)` produces reusable, parser-type-free facts
for later parser-backed rules. It returns a frozen `WorkflowAstFacts` object
with `parseSucceeded`, `lexicalBindings`, and `suppressionMasks` fields. It does
not emit diagnostics and is not wired into `lintWorkflowSource`; consuming
rules still own any future diagnostic behaviour.

`LexicalBindingFacts` records a sorted, unique `boundNames` list. Use
`isIdentifierBound(facts.lexicalBindings, name)` to check whether a workflow
body declares a name such as `parallel`, `Array`, `Number`, `Object`, or
`Math`. This model is deliberately name-based rather than scope-span-based, so
future rules can avoid false positives when user code shadows a global helper
without depending on SWC node types at the public boundary.

`WorkflowSuppressionMasks` exposes `directiveScanText` and `inertRanges`.
Strings, template literals, regex literals, and block comments stay blanked in
`directiveScanText`, while line comments are visible so a future suppression
parser can read directive comments safely. Use `isIndexInInertRegion` to test
whether a UTF-16 source-text index falls inside a blanked region. These ranges
stay in the source-masker's UTF-16 index space; do not mix them with UTF-8
`SourceSpan` offsets without an explicit conversion step.

### Workflow envelope scanner

`scanWorkflowEnvelope` accepts only an `OriginalSourceFile` created by
`createOriginalSourceFile`. Do not pass structurally reconstructed source
objects, because envelope spans depend on the private source indexes created by
the factory.

Production scanner code must call `maskNonCodeSource` before looking for
metadata, import/export tokens, braces, comments, strings, templates, or
regex-sensitive syntax. The scanner starts from masked-source UTF-16 string
indexes, then converts them back to original-source UTF-8 byte offsets before
calling `spanFromOffsets`.

Use `lintWorkflowSource` as the production entry point when a caller needs the
complete static workflow diagnostic stream for one source string. It builds the
original source file, scans the envelope, classifies metadata, and returns
diagnostics in canonical order: envelope diagnostics first, then metadata
diagnostics, body syntax diagnostics, and Claude compatibility diagnostics.
The body parser runs once for this pipeline; `odw/body-syntax` owns syntax
failures, and Claude compatibility checks consume the same successful parse
result. The package entry re-exports `lintWorkflowSource` and
`WorkflowLintResult` for future CLI and public-consumer work.

`parseWorkflowBody` remains available for standalone parser-span tests and
callers that need only body-syntax diagnostics. Callers that need full workflow
diagnostics should use `lintWorkflowSource` so the body-syntax and Claude
compatibility paths share the same normalized parse result.

Static-analysis result contracts freeze the returned result container and any
array owned by that result at runtime. Nested fact trees owned by a parser, such
as parsed metadata objects and arrays, are also frozen before they leave their
module. Reused diagnostic, source-span, and source-position value objects are
`readonly` compile-time data; consumers must not depend on recursive
runtime-freezing beyond the producer-owned containers documented by focused
tests.

The scanner records whether metadata is an object literal, a non-object
expression, an unterminated object, or a missing value. The metadata classifier
in `src/static-analysis/workflow-metadata.ts` consumes those envelope facts and
emits the runtime-invalid metadata diagnostics `odw/meta-object`,
`odw/meta-name`, and `odw/meta-description`, plus
`odw/meta-statically-unprovable` for metadata that would require source
evaluation. It must continue to parse source text passively and must not import
or call executable ODW loader, primitive, launcher, worker, runtime,
scheduler, metadata-evaluating, or agent-dispatch paths.

The focused classifier tests live in
`tests/static-analysis/workflow-metadata.test.ts`. Invalid fixture parity for
the task-owned metadata, envelope, and body-syntax rules lives in
`tests/static-analysis/invalid-workflow-metadata-parity.test.ts`; that parity
suite consumes `lintWorkflowSource` so the envelope, metadata, body-syntax, and
Claude compatibility diagnostic merge order has one implementation. Task 3.1.1
still owns user-visible `odw/claude-pure-meta` emission; do not add that
diagnostic to the metadata classifier before the pure-literal compatibility
task lands.

Production modules under `src/static-analysis/` use relative internal imports
for scanner collaborators. Public-consumer tests may import
`scanWorkflowEnvelope` and its envelope types from `"odw-lint"` to verify the
package entry.

When extending this area, keep the roadmap sequencing intact: task 2.1.4 owns
the forbidden-import architecture test for production code, task 2.2.1 owns the
shipped standalone SWC parser adapter, task 2.2.2 owns body normalization,
span mapping, and valid-example parser integration, task 2.2.4 owns reusable
workflow AST facts, which now live in the package surface, and task 3.1.1 owns
Claude pure-metadata compatibility diagnostics.

## Commit Gate

Run the full gate before committing code changes:

```sh
make all
```

`make all` runs the following targets in order:

- `make build`
- `make check-fmt`
- `make whitespace-hygiene`
- `make lint`
- `make typecheck`
- `make test`

`make build` installs dependencies through the `node_modules` Make target. That
marker depends on both `package.json` and `bun.lock`, so a lockfile-only
dependency update is expected to rerun `bun install` before formatting,
linting, type checking, or tests use the installed toolchain.

`make whitespace-hygiene` scans tracked non-binary files for trailing spaces
and tabs. It reports path and line diagnostics only; it does not rewrite raw
workflow fixtures, copied ODW examples, or snapshot files.

Build-gate command execution, tracked-file listing, temporary repository setup,
repository-relative writes, fixture commits, and captured CLI output live in
`tests/build-gate/git-support.ts`. Use the shared `createCommandRunner`
subprocess seam for gate commands, including Git through `createGitRunner`, so
gates share one command-result contract. Keep feature-specific policy in the
corresponding gate module, such as file-size path filtering, whitespace scan
rules, branch-freshness classification, and review-evidence classification.

Run `make markdownlint` as well when Markdown files change.

Run `make branch-freshness` before requesting review for roadmap task branches.
The target refreshes `origin/main`, checks protected `docs/**` and `tests/**`
changes, and fails when the task branch would present unrelated newer
main-branch work as deletions in review. It exits successfully on non-roadmap
branches, and exits with a usage error when the worktree is dirty. Keep it
outside `make all` because it performs a network fetch.

The roadmap review or audit path must run `make review-evidence` as a required
step and record its report as the review evidence; see AGENTS.md
"Roadmap Review & Audit Evidence". The target runs `make all`,
`make markdownlint`, and `make nixie` through the shared build-gate command
runner, then reports the selected dual-review path. The df12 review/audit
environment provides the full toolchain, including `nixie`, so a clean tree is
expected to report `verified`. Keep the target outside `make all` because it
re-runs `make all` and is a reviewer-run audit gate, not a recursive
commit-gate step.

Each review-evidence gate uses a five-minute command timeout by default. Slow
review environments may override the per-gate timeout with
`ODW_LINT_REVIEW_GATE_TIMEOUT_MS=<milliseconds>` or by running
`bun run tests/build-gate/review-evidence-cli.ts --gate-timeout-ms=<milliseconds>`.
Timeout overrides must be positive integer millisecond values.

`make review-evidence` exits 0 for `verified`, 1 for a failed re-run gate, 2 for
usage errors, and 3 for `degraded` evidence. A degraded report means the review
evidence is incomplete rather than passed: for example, a sandboxed reviewer can
run `bun run tests/build-gate/review-evidence-cli.ts --no-exec` to record that
command execution was unavailable. Spawn-unavailable gates are degraded because
they did not run; timed-out or killed gates are failed because they did run but
did not complete successfully. Reviewer path selection is explicit and ordered:
primary `scrutineer`, fallback `coderabbit`, then degraded
`local-self-run` when no independent reviewer remains. The report names the
selected path so quota-blocked review cannot be silently substituted.

Run `make refresh-fixtures` after changing workflow fixture source, copied ODW
examples, or static-analysis fixture manifests. The target refreshes fixture
hashes, invalid diagnostic spans and reviewer-facing span text, then prints a
JSON report of changed, unchanged and out-of-scope paths.

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

The Bun suite includes a file-size guard in
`tests/build-gate/file-size.test.ts`, so `make all` runs it through
`make test`. The guard covers tracked TypeScript files under `src/` and
`tests/`, with a limit of 400 physical source lines per file. Raw JavaScript
workflow fixtures, snapshots, documentation, generated output, ignored paths
and untracked scratch files are intentionally out of scope for roadmap task
1.5.1. Untracked scratch files stay outside the guard because they are not
reviewable commit content. Non-TypeScript code-file enforcement is also
deferred; add a separate roadmap task before extending the guard to JavaScript
fixtures, shell scripts, generated examples, or other file families.

The Bun suite includes a package export-surface guard in
`tests/diagnostics/public-api-surface.test.ts`. Intentional public API changes
to the package entry must update that file's reviewed
`EXPECTED_PUBLIC_PACKAGE_EXPORTS` list in the same change, so accidental
removals from `src/index.ts` fail the default repository gate.

The rule catalogue is the production source of truth for rule identifiers,
categories, default severities, configuration keys, documentation slugs, and
diagnostic message contracts, including reviewed message templates for dynamic
parser-backed messages. The diagnostic JSON Schema derives its `rule` enum from
`RULE_IDS`, and rule documentation pages under `docs/rules/` must begin with
this fixed metadata table before any prose:

```markdown
# `odw/example-rule`

| Field | Value |
| --- | --- |
| Rule ID | `odw/example-rule` |
| Category | `dialect` |
| Default severity | `error` |
| Configuration key | `odw/example-rule` |
| Release status | `released` |
```

`tests/diagnostics/rule-catalogue-docs.test.ts` checks that every catalogue
entry has a matching page, that metadata values match the catalogue, and that
`docs/rules/index.md` links to every rule page.
`tests/diagnostics/schema.test.ts` checks that the JSON Schema enum uses the
same `RULE_IDS` array. Update the catalogue, schema snapshot, rule page, index,
fixture manifest expectations, and parity test expectations in the same change
when adding, renaming, releasing, or changing the reviewed messages for a rule.

### Message templates

Rule authors use `messageTemplates` only when a diagnostic must include
source-specific parser detail that cannot be reviewed as one exact string.
Templates are authored as raw strings in the rule catalogue and are parsed by
`createMessageTemplate` when the catalogue entry is built. `odw/body-syntax`
now carries a reviewed template for source-specific parser detail; other rules
remain exact-message only until they emit dynamic parser-backed diagnostics.

A template placeholder is written as `{name}`. The name must begin with an
ASCII letter and may continue with ASCII letters or digits. Literal `{` and
`}` characters are not part of the template grammar today; add a design note
before introducing escape syntax. Empty placeholders, whitespace in placeholder
names, numeric first characters, unclosed `{`, and unopened `}` are rejected
when the catalogue is constructed. Reviewed templates are also bounded by
length and placeholder-count limits so matcher construction stays predictable.

`renderMessageTemplate(template, values)` requires the value object to contain
exactly the placeholder names declared by the template. Missing keys, unknown
extra keys, inherited keys, and empty string values are errors. Repeated
placeholder occurrences render the same value each time.

`messageMatchesTemplate(template, message)` answers whether a concrete
diagnostic message could have been rendered from the reviewed template. Matching
is whole-message only: literal text is escaped, placeholders match one or more
characters, repeated placeholders must match the same dynamic text, and
unrelated prefixes, suffixes, empty placeholder runs, or overlong candidate
messages fail. Fixture parity uses this helper rather than substring checks, so
dynamic messages remain reviewable.

Behavioural tests should use `@aboviq/bun-test-cucumber` with Gherkin feature
files. Snapshot tests should use Bun's built-in snapshot testing support.
Property tests should use `fast-check`, and exhaustive bounded proofs should use
`lemmascript` where a proof is the right level of rigour.

### Workflow Fixture Corpus

ODW example workflow snapshots live under
`tests/static-analysis/fixtures/odw-examples/`. Refresh them from the
source-backed sibling checkout identified by `ODW_REFERENCE_CHECKOUT`; do not
record host-specific absolute paths in committed documentation or manifests.
Run the refresh through the Make target so dependency installation and the
script entry point stay consistent:

```sh
make refresh-fixtures
```

When `ODW_REFERENCE_CHECKOUT` is unset, the script looks for a sibling
`open-dynamic-workflows/` checkout from either the ordinary repository layout
or a df12 worktree layout. Set `ODW_REFERENCE_CHECKOUT` to an absolute or
repository-relative path when using another source-backed checkout:

```sh
ODW_REFERENCE_CHECKOUT=../open-dynamic-workflows make refresh-fixtures
```

The copied `.js` snapshots are intentionally excluded from Biome and Oxlint so
their source stays byte-for-byte identical to upstream ODW examples. Do not
format or rewrite those files in this repository. Update
`tests/static-analysis/fixtures/odw-examples.ts` when refreshing the corpus so
the manifest records the new hashes and the expected `no-error` diagnostics.

Invalid workflow fixtures live under
`tests/static-analysis/fixtures/invalid-workflows/`. They are deliberately raw
inputs for missing metadata, malformed metadata, unsupported import/export, and
syntax-error coverage. The `hostile-metadata` family is also raw invalid input:
its metadata expressions would write a global marker, throw a custom marker,
write a marker file, or read an environment probe and surface it through a
marker if evaluated. Add hostile fixtures through `make refresh-fixtures` so
their hashes, spans, and reviewer-facing `spanText` remain derived from source
text rather than hand-edited.
Do not import, evaluate, execute, or format invalid workflow fixtures as
ordinary JavaScript. Keep `tests/static-analysis/fixtures/invalid-workflows.ts`
in sync with every raw fixture by updating the family, path, SHA-256 hash,
expected status, diagnostic rule, severity, message, UTF-8 source span, and
reviewer-facing `spanText`. Fixture diagnostic expectations are checked against
the rule catalogue for rule identifier, default severity, exact reviewed
messages or reviewed message templates, and documentation path parity. Dynamic
parser-backed messages must match catalogue-owned templates instead of broad
substring assertions. When an invalid fixture needs a different reviewer-facing
`message`, extend the matching catalogue entry in the same change rather than
treating the manifest as a separate source of truth.
When intentionally bumping `@swc/core`, re-observe the `odw/body-syntax`
parser detail for the `syntax-error` invalid workflow family and update these
surfaces together: the raw fixtures under
`tests/static-analysis/fixtures/invalid-workflows/syntax-error/`, their
manifest at
`tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`,
and the parser snapshot at
`tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`.
Diagnostic documentation paths are derived from `ruleDocsPath(rule)` and remain
repository-relative paths under `docs/rules/`; hosted URLs belong in later
reporting or documentation presentation layers. For invalid diagnostic spans,
choose a `spanText` anchor that appears exactly once in the raw fixture source.
The refresh script derives UTF-8 offsets, display line and column positions
from that anchor. If the anchor is missing or duplicated, update the manifest
intentionally rather than guessing a span.

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
import, evaluate or execute workflow bodies during ordinary tests.
`tests/static-analysis/hostile-metadata-security.test.ts` owns the no-side
effect lint regression for hostile metadata fixtures. It observes the global
marker, marker-file absence, and environment-derived marker value while linting
fixture source text through the static analysis path and the public package
entry.

After a refresh, review the JSON report and the Git diff. Then run:

```sh
make all
make markdownlint
make nixie
```

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
occupies two UTF-8 byte offsets; the offset between the carriage return and
line feed is not a valid display position. The Unicode separators each occupy
three UTF-8 byte offsets, and interior bytes are not valid display positions.

Use `spanFromOffsets(file, startOffset, endOffset)` for half-open spans where
`startOffset` is inclusive and `endOffset` is exclusive. Use `sliceSourceSpan`
or `snippetForSpan` only after the span has been validated against the same
`OriginalSourceFile`; both helpers re-check caller-supplied spans so stale
line, column, or offset data cannot produce misleading text.

`tests/static-analysis/body-diagnostic-spans.test.ts` is the parser-backed
span snapshot suite for the design invariant in
`docs/technical-design.md` §11.5. It builds invalid workflow bodies in memory
and checks each `odw/body-syntax` diagnostic span against an independent
UTF-8 byte oracle, `sliceSourceSpan`, and `snippetForSpan`. The matrix covers
LF, CRLF, Unicode BMP and astral code points, comments, regex literals,
template text, and template interpolation. The snapshots intentionally record
the whole body slice while the body parser keeps the S2 whole-body fallback;
future narrowing belongs to roadmap task 2.2.6.

Internal source-helper ownership is split by responsibility:

- `src/static-analysis/source-file.ts` creates `OriginalSourceFile` records and
  re-exports the public source-span helpers as the compatibility facade.
- `src/static-analysis/source-scan.ts` performs the single production scan over
  original source text, building line metadata, display positions, UTF-8 byte
  offsets, and UTF-16 text indexes.
- `src/static-analysis/source-indexes.ts` owns private index storage and
  guarded lookup for factory-created source records.
- `src/static-analysis/source-mask.ts` is the inert-region masking facade and
  scan orchestrator for future envelope scans. It exposes `maskNonCodeSource`,
  keeps scanner ordering, and preserves UTF-16 text indexes and line
  terminators.
- `src/static-analysis/source-mask-types.ts` owns mask data types used by the
  facade and internal scanner modules.
- `src/static-analysis/source-mask-delimiters.ts` owns shared delimiter and
  range helpers, including line-terminator classification and range blanking.
- `src/static-analysis/source-mask-comments.ts`,
  `src/static-analysis/source-mask-strings.ts`,
  `src/static-analysis/source-mask-templates.ts`, and
  `src/static-analysis/source-mask-regex.ts` own the comment, quoted-string,
  template-literal, and regex-literal token scanners. External scanner code
  still calls `maskNonCodeSource` rather than importing these internal modules.
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
