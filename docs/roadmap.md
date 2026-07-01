# odw-lint roadmap

This roadmap sequences the work described in
[terms-of-reference.md](terms-of-reference.md) and
[technical-design.md](technical-design.md). It follows the GIST alignment:
phases state ideas, steps pursue workstreams that validate or falsify those
ideas, and tasks are review-sized execution units.

The roadmap makes no date or duration commitments. It assumes implementation
will proceed in the existing Bun and TypeScript repository, with
static-boundary decisions captured in [adr](adr/) before code relies on them.

## 1. Foundational phase: static workflow contract

Idea: if `odw-lint` settles its static workflow model, diagnostic contract, and
fixture corpus before adding broad rules, later slices can focus on useful
workflow feedback rather than reworking parser and reporter boundaries.

This phase proves that an ODW workflow can be analysed without executing source
and that diagnostics can point back to the original file.

### 1.1. Ratify the static-analysis and packaging boundary

This step records that `odw-lint` owns an SWC-based static parser for v1 and
ships the standalone `odw-lint check` command. The command is path/glob-first;
ODW-style name resolution and any `odw check` subcommand are deferred to future
ODW integration. This decision informs command naming, package exports, fixture
ownership, and integration tests. See
[technical-design.md](technical-design.md) §§5, 7 and 13, and
[0001-static-analysis-boundary.md](adr/0001-static-analysis-boundary.md).

- [x] 1.1.1. Scaffold the owned SWC-based static-analysis module boundary.
  - See [technical-design.md](technical-design.md) §5 and
    [0001-static-analysis-boundary.md](adr/0001-static-analysis-boundary.md).
  - Success: production code has a named `odw-lint` static-analysis source of
    truth, with no dependency on ODW publishing a static API or vendoring ODW
    helper source.
- [x] 1.1.2. Write an ADR recording the standalone v1 packaging boundary.
  - Requires 1.1.1.
  - See [technical-design.md](technical-design.md) §§7 and 13.
  - Success: the ADR states that `odw-lint check` is the v1 command and
    `odw check` is deferred.
- [x] 1.1.3. Define the public command contract in repository docs.
  - Requires 1.1.1.
  - See [technical-design.md](technical-design.md) §7.
  - Success: command arguments, flags, and exit codes match the
    `ruff check`-style design.
  - [x] 1.1.3.1. Add the first user-facing guide.
    - Addendum (from audit:1.5.1; low). Add a minimal user's guide covering
      the intended `odw-lint check` command shape, diagnostic report contract,
      rule-reference navigation, configuration placeholders, and current
      non-goals before the first executable CLI slice lands. Lightweight
      addendum pass.

### 1.2. Build the diagnostic and source-position spine

This step answers whether all rules can report through one stable diagnostic
shape. The result informs every parser, rule, and reporter task. See
[technical-design.md](technical-design.md) §§8 and 11.5.

- [x] 1.2.1. Implement the diagnostic type, severity model, rule identifier
  type, JSON schema envelope, and summary counts.
  - See [technical-design.md](technical-design.md) §8.
  - Success: JSON output includes `schemaVersion`, `tool`, `summary`, and
    `diagnostics`, and text output is generated from the same diagnostics.
  - [x] 1.2.1.1. Harden diagnostic reporter contracts.
    - Addendum (from review:1.2.1 and audit:1.2.1; medium). Normalize
      text-only control whitespace and snapshot report diagnostics to protect
      one-line text output and report-envelope consistency. Lightweight
      addendum pass.
  - [x] 1.2.1.2. Add severity mirror exhaustiveness checks.
    - Addendum (from review:1.2.1; medium). Make future severity additions
      fail type checking unless summary counts, schema enums, and tests are
      updated together. Lightweight addendum pass.
  - [x] 1.2.1.3. Validate report file counts at the boundary.
    - Addendum (from review:1.2.1; medium). Convert raw file counts into a
      non-negative integer report value before JSON emission. Lightweight
      addendum pass.
- [x] 1.2.2. Implement line-index and source-span helpers for original files.
  - See [technical-design.md](technical-design.md) §§6.1 and 11.5.
  - Success: offsets, lines, columns, and snippets round-trip for fixtures
    with LF, CRLF, Unicode, and trailing-newline variants.
  - [x] 1.2.2.1. Clarify the original-source construction contract.
    - Addendum (from review:1.2.2 and audit:1.2.2; medium). Make the
      `OriginalSourceFile` construction requirement visible in the public API
      contract, including the nominal or structural construction decision.
      Lightweight addendum pass.
  - [x] 1.2.2.2. Single-source production source scanning.
    - Addendum (from audit:1.2.2; medium). Refactor production source scanning
      so line metadata and private lookup indexes come from one pass while the
      property-test oracle stays independent. Lightweight addendum pass.
  - [x] 1.2.2.3. Document source-span helper usage.
    - Addendum (from audit:1.2.2; low). Add source-span helper examples and
      maintainer guidance for UTF-8 offsets, display columns, and half-open
      original-source spans. Lightweight addendum pass.
  - [x] 1.2.2.4. Clean up source-file property-test harness repetition.
    - Addendum (from audit:1.2.2; low). Centralize generated source setup for
      source-file property tests without sharing production scanner logic.
      Lightweight addendum pass.
  - [x] 1.2.2.5. Add JavaScript line-separator source-span coverage.
    - Addendum (from audit:1.3.2, audit:1.3.3, and audit:1.3.4; medium).
      Cover U+2028 and U+2029 as JavaScript line terminators in source-span
      helpers before parser-backed diagnostics depend on them. Lightweight
      addendum pass.
- [x] 1.2.3. Split the diagnostic contract into focused modules.
  - Requires 1.2.1.
  - Move diagnostic types, rule-id parsing, report helpers, text formatting,
    and schema construction behind focused internal modules while preserving
    the explicit package entry point.
  - Success: the public API remains importable through `odw-lint`, and each
    diagnostic responsibility has one named module before parser, CLI, and
    rule-engine responsibilities land.
  - [x] 1.2.3.1. Add diagnostic schema and architecture-test cleanup.
    - Addendum (from audit:1.2.3; low). Extract private diagnostic schema
      shape helpers and separate architecture-test query helpers from
      assertions. Lightweight addendum pass.
  - [x] 1.2.3.2. Synchronize package-entry documentation.
    - Addendum (from audit:1.3.3 and audit:1.3.4; medium). Bring the
      developer guide and `src/index.ts` file documentation back into
      alignment with the current private package entry and exported
      static-analysis surface. Lightweight addendum pass.
- [x] 1.2.4. Split source-file helper responsibilities before parser
  span-mapping work.
  - Requires 1.2.2.
  - Separate scanning, validation, slicing, snippet, and construction concerns
    in `src/static-analysis/source-file.ts` without changing source-span
    behaviour.
  - Success: the source-position spine keeps one original-source contract
    while parser and span-mapper work have focused helper modules to extend.
  - [x] 1.2.4.1. Tighten internal source-helper export surface.
    - Addendum (from review:1.2.4 and audit:1.2.4; low). Remove or justify
      the unused source-scan byte-length helper and update architecture
      coverage so private helper modules do not keep dead exports. Lightweight
      addendum pass.
  - [x] 1.2.4.2. Clarify deferred review status in the ExecPlan.
    - Addendum (from review:1.2.4; low). Reconcile the task 1.2.4 ExecPlan
      outcomes and revision notes so review status is unambiguous. Lightweight
      addendum pass.

### 1.3. Establish the workflow fixture corpus

This step answers whether the linter has enough representative source to detect
regressions. The fixture corpus informs loader parity, rule behaviour, and
future ODW integration. See [technical-design.md](technical-design.md) §11.1.

- [x] 1.3.1. Import ODW example workflows as read-only fixture snapshots.
  - See [technical-design.md](technical-design.md) §11.1.
  - Success: every fixture records expected "no error" status before any rule
    broadening.
  - [x] 1.3.1.1. Derive ODW example fixture paths from file names.
    - Addendum (from review:1.3.1 and audit:1.3.1; medium). Derive
      `fixturePath` and `upstreamPath` from each manifest `fileName` and pin
      path invariants in tests. Lightweight addendum pass.
- [x] 1.3.2. Add invalid fixture families for missing metadata, malformed
  metadata, unsupported imports or exports, and syntax errors.
  - See [technical-design.md](technical-design.md) §§9.1 and 11.1.
  - Success: each invalid fixture has expected rule identifiers and source
    spans.
  - [x] 1.3.2.1. Add shared fixture-manifest deep-freeze helper.
    - Addendum (from review:1.3.2; medium). Centralize nested immutability for
      valid and invalid fixture manifests as span objects, diagnostics, and
      suggestions grow. Lightweight addendum pass.
- [x] 1.3.3. Add masking fixtures with decoy workflow syntax inside comments,
  strings, regex literals, and template literals.
  - See [technical-design.md](technical-design.md) §§6.2 and 11.1.
  - Success: decoy syntax does not produce envelope diagnostics.
  - [x] 1.3.3.1. Add semantic masking fixture content assertions.
    - Addendum (from review:1.3.3; low). Assert planned marker snippets for
      escaped quotes, regex delimiters, template text, and interpolation so
      fixture failures explain intent beyond hash drift. Lightweight addendum
      pass.
  - [x] 1.3.3.2. Add delimiter-stress masking fixture variants.
    - Addendum (from review:1.3.3; low). Extend masking fixtures with escaped
      quotes, escaped regex delimiters, template interpolation boundaries,
      CRLF, and Unicode variants. Lightweight addendum pass.
- [x] 1.3.4. Add hostile metadata fixtures that would leave an observable side
  effect if evaluated.
  - See [technical-design.md](technical-design.md) §§11.1 and 11.3.
  - Success: the fixture produces diagnostics and no side-effect marker.
  - [x] 1.3.4.1. Split invalid workflow fixture manifests by family.
    - Addendum (from audit:1.3.2 and audit:1.3.4; medium). Split the
      near-limit invalid workflow manifest by fixture family before further
      corpus growth makes reviews and file-size limits brittle. Lightweight
      addendum pass.
  - [x] 1.3.4.2. Extract fixture-corpus support helpers.
    - Addendum (from audit:1.3.3 and audit:1.3.4; low). Centralize repeated
      fixture hashing and source-reading helpers across corpus tests before
      loader parity and real lint execution reuse them. Lightweight addendum
      pass.
- [x] 1.3.5. Add fixture metadata generation and refresh tooling.
  - Requires 1.3.1, 1.3.2, 1.3.3, and 1.3.4.
  - Provide a focused script or Make target that refreshes fixture hashes,
    UTF-8 spans, display positions, and reviewer-facing span text without
    executing or formatting raw workflow fixtures.
  - Success: maintainers can refresh valid, invalid, masking, and hostile
    fixture metadata with one documented command and review deterministic
    changes.
  - [x] 1.3.5.1. Centralize fixture refresh path and failure helpers.
    - Addendum (from audit:1.5.1; medium). Single-source duplicated refresh
      URL normalization and repeated non-argument refresh failure construction
      so fixture refresh reports, checkout resolution, and missing-upstream
      errors cannot diverge. Lightweight addendum pass.

### 1.4. Harden repository build-gate freshness

This step answers whether repository gates reproduce the dependency state
recorded in committed package files before parser and rule work expands. It
informs later implementation tasks that rely on `make build`, `make lint`,
`make typecheck`, `make test`, and `make all` using the locked toolchain.

- [x] 1.4.1. Make dependency installation sensitive to lockfile-only changes.
  - Requires 1.1.1.
  - Update the build dependency marker so `make build` refreshes
    `node_modules` when either `package.json` or `bun.lock` changes.
  - Success: a lockfile-only dependency change cannot leave the Makefile gates
    using stale installed packages.

### 1.5. Harden roadmap-workflow review gates

This step answers whether repository conventions and roadmap-branch freshness
can be enforced automatically before parser, rule, and reporter work expands.
Its outcome informs later review gates that must catch workflow defects without
depending on manual post-commit audits.

- [x] 1.5.1. Add an automated file-size guard for source and test code.
  - Requires steps 1.1-1.3.
  - Make the AGENTS.md source and test file-size convention executable in the
    repository gate.
  - Success: `make all` or an equivalent commit gate fails when source or test
    TypeScript files exceed the configured project limit.
  - [x] 1.5.1.1. Reconcile file-size guard scope and Git runner shapes.
    - Addendum (from review:1.5.1; low). Align the injectable Git runner result
      type with Bun's nullable spawn output and clarify the documented
      difference between tracked TypeScript enforcement, ignored untracked
      scratch paths, and deferred non-TypeScript code-file policy. Lightweight
      addendum pass.
  - [x] 1.5.1.2. Split near-limit architecture and fixture refresh suites.
    - Addendum (from audit:1.5.1; medium). Split broad architecture and
      fixture metadata refresh coverage by contract before either suite reaches
      the file-size guard during unrelated parser or fixture work. Lightweight
      addendum pass.
- [x] 1.5.2. Add a branch-freshness review guard for roadmap tasks.
  - Requires steps 1.1-1.4.
  - Detect task branches that would delete newer `origin/main` roadmap, docs,
    or test work outside the declared task scope after fetching current
    `origin/main`.
  - Success: review or gate output flags stale task branches before they can
    present unrelated main-branch work as deletions.
- [x] 1.5.3. Add a public API removal guard for package exports.
  - Requires 1.2.3.
  - Add an export-surface snapshot or architecture test that compares the
    declared package entry against intentional public API changes.
  - Planning constraint: explicitly refresh and verify `origin/main` with a
    remote-tracking update before restoring or diffing canonical files. Any
    semantic guard against stale roadmap/docs deletions must allow the
    intentional `1.5.3` roadmap completion tick, or run before that closeout
    edit and separately prove the tick is the only remaining roadmap change.
  - Success: `make all` or an equivalent review gate fails when a roadmap
    slice accidentally removes exported `odw-lint` symbols.
  - [x] 1.5.3.1. Extract shared package-entry support.
    - Addendum (from audit:2.1.6; medium). Centralize package manifest parsing
      and package facade export extraction for public API and architecture
      tests. Lightweight addendum pass.
- [x] 1.5.4. Add tracked-file whitespace hygiene to the commit gate.
  - Requires 1.5.2.
  - Add a lightweight whitespace check for tracked files or diffs so committed
    snapshots and fixtures cannot carry trailing whitespace after normal gates
    pass.
  - Reuse tracked-file enumeration from branch-freshness only if the
    whitespace guard proves the shared helper shape; otherwise keep the gate
    local until a second write-side hygiene check needs it.
  - Success: the repository gate fails on trailing whitespace without
    reformatting raw fixture files.
- [x] 1.5.5. Consolidate build-gate Git support behind one helper seam.
  - Requires 1.5.1, 1.5.2, and 1.5.4.
  - Addendum source: audit:2.1.7; medium.
  - Share the Git runner, tracked-file listing, temporary-repository setup, and
    CLI output capture used by file-size, branch-freshness, and whitespace
    hygiene gates while preserving each gate's feature-specific policy.
  - Success: build-gate tests exercise one documented Git support helper and no
    gate carries a forked subprocess or tracked-file enumeration contract.

## 2. First vertical slice: ODW dialect validation

Idea: if the first shipped check catches ODW dialect errors with trustworthy
spans and zero workflow execution, authors can use the tool before any
heuristic lint rules exist.

This phase delivers the narrowest useful `check` command: it reads workflow
files, validates the ODW envelope, parses the normalized body, and reports
fatal dialect errors.

### 2.1. Parse the ODW envelope without executing source

This step answers whether the linter can reproduce ODW's loader boundary
statically. It unlocks metadata rules and body parsing. See
[technical-design.md](technical-design.md) §§5, 6.2, 6.4, and 9.1.

- [x] 2.1.1. Implement a source masker for comments, strings, template
  literals, and regex literals.
  - Requires steps 1.1-1.3 and 2.1.4.
  - See [technical-design.md](technical-design.md) §§5 and 6.2.
  - Success: masking fixtures from 1.3.3 produce zero envelope diagnostics, and
    each manifest `metaName` matches the real metadata declaration extracted
    from original source.
  - Completion note: whole template literals are inert for envelope masking,
    and the committed test-only probe consumes the masking fixture manifest
    without adding the production envelope scanner.
- [x] 2.1.2. Implement static `export const meta` extraction and unsupported
  import/export detection.
  - Requires 2.1.1 and 2.1.6.
  - See [technical-design.md](technical-design.md) §§6.2 and 9.1.
  - Success: valid ODW examples pass envelope scanning and invalid import or
    export fixtures fail with exact spans.
  - Completion note: `scanWorkflowEnvelope` now extracts the real masked
    metadata declaration without executing source, records metadata value
    state, preserves Unicode-safe UTF-8 spans, and emits exact
    `odw/no-import-export` diagnostics for unsupported fixtures. Metadata
    field classification remains deferred to 2.1.3.
- [x] 2.1.3. Implement metadata classification for runtime-invalid,
  statically unprovable, and Claude-incompatible cases.
  - Requires 2.1.2.
  - See [technical-design.md](technical-design.md) §§6.3 and 9.1.
  - Success: computed metadata receives `odw/meta-statically-unprovable`
    rather than being executed or collapsed into an ordinary ODW-invalid
    diagnostic.
  - Completion note: `classifyWorkflowMetadata` now emits runtime-invalid
    metadata diagnostics and one passive `odw/meta-statically-unprovable`
    warning for computed metadata, with invalid fixture parity and hostile
    source tests proving classification does not evaluate workflow metadata.
    User-visible `odw/claude-pure-meta` emission remains deferred to task
    3.1.1.
- [x] 2.1.4. Add a forbidden-import architecture test for production code.
  - Requires 1.1.1.
  - See [technical-design.md](technical-design.md) §§5 and 11.3.
  - Planning constraint: cover both bare executable ODW imports and
    package-entry
    bypasses such as `odw/src/index`, `odw/dist/index`, explicit `.ts` or `.js`
    forms, and sibling path-style equivalents ending in
    `/open-dynamic-workflows/src/index` or
    `/open-dynamic-workflows/dist/index`. Keep work items atomic and gateable:
    introduce filesystem/path helpers only in the work item that first uses
    them. This is a test-only guard; if real production offenders under `src/`
    are found, stop and surface the offender instead of editing production code
    inside this task.
  - Success: production modules cannot import executable ODW loader,
    primitive, runtime launcher, or worker paths.
  - [x] 2.1.4.1. Split import architecture helpers.
    - Addendum (from audit:2.1.6; medium). Split source parsing, import-edge
      extraction, ODW import policy, and export facts into focused test
      helpers. Lightweight addendum pass.
- [ ] 2.1.5. Add the hostile metadata security regression test.
  - Requires 1.3.4 and 2.1.3.
  - See [technical-design.md](technical-design.md) §11.3.
  - Success: linting hostile metadata leaves no side-effect marker.
- [x] 2.1.6. Introduce the typed rule catalogue and rule-doc parity checks.
  - Requires 1.2.1.
  - Store rule identifiers, categories, default severities, docs slugs, and
    release status in one production catalogue before envelope diagnostics
    broaden.
  - Success: released rule identifiers, default severities, configuration
    keys, and `docs/rules/` pages are checked against the catalogue.
  - [x] 2.1.6.1. Fail rule-doc parity on orphan rule pages.
    - Addendum (from review:2.1.6; low). Enumerate `docs/rules/*.md` except
      `index.md` and fail when any page slug is absent from `RULE_CATALOGUE`.
      Lightweight addendum pass.
  - [x] 2.1.6.2. Surface the rule reference in user navigation.
    - Addendum (from audit:2.1.6; low). Link `docs/rules/index.md` from the
      first user-facing or interim developer-guide navigation surface.
      Lightweight addendum pass.
- [x] 2.1.7. Add rule-catalogue parity checks for fixture diagnostics.
  - Requires 2.1.6 and step 1.3.
  - Check fixture manifest expectations against the typed rule catalogue so
    rule identifiers, default severities, messages, and rule documentation do
    not become parallel sources of truth.
  - Success: fixture expectations fail when a diagnostic rule, default
    severity, message contract, or docs slug diverges from the catalogue.
  - [x] 2.1.7.1. Guard representative diagnostic examples against catalogue
    message drift.
    - Addendum source: review:2.1.7; low.
    - Make public consumer or type examples use catalogue-backed diagnostic
      messages where representative examples would otherwise preserve stale
      literal strings.
    - Success: changing a reviewed catalogue message breaks the representative
      example contract before examples drift.
- [ ] 2.1.8. Define diagnostic message templates for parser-backed rules.
  - Requires 2.1.7.
  - Addendum source: review:2.1.7; medium.
  - Introduce the typed template contract needed for source-specific diagnostic
    interpolation before parser-backed body rules start emitting dynamic
    messages. Update the architecture and public API guard fixtures when the
    template module or package-entry exports change.
  - Success: fixture parity can continue checking reviewed messages without
    weakening dynamic diagnostics to broad string assertions, and
    `tests/diagnostics/architecture-fixtures.ts` plus
    `tests/diagnostics/public-api-fixtures.ts` pin the new module and exports.
- [x] 2.1.9. Split source-mask token scanners into focused modules.
  - Requires 2.1.1.
  - Addendum source: audit:2.1.7; medium.
  - Separate comment, string, template, regex, and delimiter masking helpers so
    future envelope and AST-fact work extends focused scanners instead of a
    near-limit production file.
  - Success: the source-mask facade preserves current masking behaviour, each
    token family has a named implementation home, and existing masking fixture
    and property tests remain green.
- [x] 2.1.10. Canonicalize diagnostic rule documentation link contracts.
  - Requires 2.1.6.
  - Addendum source: audit:2.1.7; medium.
  - Choose one emitted documentation-link shape for rule diagnostics and update
    catalogue, schema, docs, and tests before text and JSON reporters expose the
    field to downstream integrations.
  - Success: diagnostic metadata exposes one tested rule-documentation reference
    format and no code or docs describe a competing URL/path shape.

### 2.2. Normalize and parse workflow bodies with SWC

This step answers whether ODW's top-level body can be represented as parseable
source without losing span fidelity. It informs all later AST rules. See
[technical-design.md](technical-design.md) §§6.1 and 11.5.

- [ ] 2.2.1. Add `@swc/core` and implement the parser adapter.
  - Requires 2.1.2 and 2.1.8.
  - See [technical-design.md](technical-design.md) §§4 and 6.1.
  - Success: body syntax errors become `odw/body-syntax` diagnostics rather
    than thrown exceptions.
- [ ] 2.2.2. Implement body normalization for top-level `return` and
  `await`.
  - Requires 2.2.1.
  - See [technical-design.md](technical-design.md) §§4 and 6.1.
  - Success: ODW examples containing top-level `return` and `await` parse with
    original-source span mapping.
- [ ] 2.2.3. Add span snapshot assertions for parser-backed diagnostics.
  - Requires 2.2.2.
  - See [technical-design.md](technical-design.md) §11.5.
  - Success: each body diagnostic includes a stable original-source snippet
    across LF, CRLF, Unicode, comments, regex literals, template text, and
    template interpolation.
- [ ] 2.2.4. Implement workflow AST facts for lexical bindings and source
  masks.
  - Requires 2.1.9 and 2.2.2.
  - See [technical-design.md](technical-design.md) §§6.2 and 9.3.
  - Provide binding facts for global-helper shadowing and original-source
    comment or literal masks for suppression parsing.
  - Success: rule tests can distinguish JavaScript globals from shadowed
    `parallel`, `Array`, `Number`, `Object`, and `Math` identifiers, and
    directive-like text in strings, templates, regexes, and block comments is
    ignored.

### 2.3. Prove ODW loader parity before shipping dialect checks

This step answers whether the first useful checker matches ODW's accepted and
rejected workflow classes without calling executable loader paths in production
code. It informs whether phase 2 can ship. See
[technical-design.md](technical-design.md) §§11.2 and 11.3.

- [ ] 2.3.1. Add a minimal loader-parity harness against trusted ODW example
  snapshots and known invalid fixtures.
  - Requires steps 2.1-2.2.
  - See [technical-design.md](technical-design.md) §11.2.
  - Success: current ODW examples have no dialect errors and known invalid
    cases map to expected rule classes.
- [ ] 2.3.2. Add dual-compat parity fixtures for pure metadata and
  deterministic-time warnings.
  - Requires 2.3.1.
  - See [technical-design.md](technical-design.md) §§9.2 and 11.2.
  - Success: `odw-lint` diagnostics match the trusted static expectations for
    `checkMeta` and `scanDualCompat` without importing executable runtime
    paths in production code.
- [ ] 2.3.3. Consume invalid fixture manifests in dialect diagnostic tests.
  - Requires steps 2.1-2.2.
  - Drive parser, envelope, and metadata-rule assertions from the invalid
    fixture manifest instead of duplicating expected diagnostics in later test
    suites.
  - Success: invalid fixture expectations remain the source of truth for
    emitted dialect diagnostics and original-source spans.

### 2.4. Ship the minimal `check` command

This step answers whether the checker can run as a normal repository gate. It
unlocks CI adoption and user feedback. See
[technical-design.md](technical-design.md) §§7 and 15.

- [ ] 2.4.1. Implement `odw-lint check` for explicit file paths.
  - Requires steps 2.1-2.3.
  - See [technical-design.md](technical-design.md) §7.
  - Success: the command returns the designed exit codes for valid and invalid
    fixtures.
- [ ] 2.4.2. Add text output with file, line, column, severity, rule, and
  message.
  - Requires 1.2.1 and 2.4.1.
  - See [technical-design.md](technical-design.md) §8.
  - Success: human output contains enough location information to fix a
    fixture without opening JSON.
- [ ] 2.4.3. Add JSON output and a JSON contract fixture.
  - Requires 1.2.1, 2.1.10, and 2.4.1.
  - See [technical-design.md](technical-design.md) §8.
  - Success: JSON output is stable under snapshot tests and includes the
    versioned envelope.
- [ ] 2.4.4. Add Ruff-compatible invocation semantics for output, config,
  stdin, ignore handling, and exit-code policy.
  - Requires 2.4.1, 2.4.2, and 2.4.3.
  - See [technical-design.md](technical-design.md) §§7.0-7.4.
  - Success: fixtures cover `--output-format`, `--output-file`,
    `--stdin-filename`, `--config`, `--isolated`, `--respect-gitignore`,
    `--force-exclude`, `--exit-zero`, and `--exit-non-zero-on-fix`.

## 3. Second vertical slice: portability and orchestration feedback

Idea: if `odw-lint` can separate hard ODW errors from Claude portability and
orchestration risks, authors can improve workflows without being blocked by
heuristic findings.

This phase adds the rules that make the tool more than a syntax checker while
keeping default severities conservative.

### 3.1. Add Claude compatibility diagnostics

This step answers whether ODW-only validity and Claude portability can be
reported clearly in one command. The result informs strict-mode policy. See
[technical-design.md](technical-design.md) §9.2.

- [ ] 3.1.1. Implement pure-literal metadata compatibility checks.
  - Requires 2.1.3 and step 2.3.
  - See [technical-design.md](technical-design.md) §§6.3 and 9.2.
  - Success: ODW-valid but Claude-incompatible metadata produces
    `odw/claude-pure-meta`.
- [ ] 3.1.2. Implement deterministic-time and randomness warnings for
  `Date.now()`, `Math.random()`, and arg-less `new Date()`.
  - Requires 2.2.2.
  - See [technical-design.md](technical-design.md) §9.2.
  - Success: warnings match ODW's `scanDualCompat` behaviour for trusted
    fixtures.
- [ ] 3.1.3. Implement `--strict-claude` severity promotion.
  - Requires 3.1.1 and 3.1.2.
  - See [technical-design.md](technical-design.md) §§7.3 and 9.2.
  - Success: strict mode exits non-zero for Claude compatibility warnings.

### 3.2. Add first orchestration-risk rules

This step answers whether AST-backed heuristics can produce useful warnings
without blocking dynamic workflows. It informs future rule severity defaults.
See [technical-design.md](technical-design.md) §9.3.

- [ ] 3.2.1. Implement bounded-loop detection around agent dispatch.
  - Requires steps 2.1-2.4.
  - See [technical-design.md](technical-design.md) §9.3.
  - Decide whether raw orchestration-risk fixtures under
    `tests/static-analysis/fixtures/orchestration-risk/` are lint-owned
    fixtures or excluded raw inputs, then update `biome.jsonc` and
    `.oxlintrc.json` with validation for those changed config files.
  - Treat `Array.from(...)`, `new Array(...)`, `Object`, `Number`, and `Math`
    helper expressions as bounded only when binding analysis proves they are
    the JavaScript globals; otherwise classify the expression as dynamic.
  - Success: the bounded ODW `loop-until-dry` example passes while an
    unbounded dispatch loop fixture warns, and shadowed `Array`, `Object`,
    `Number`, and `Math` helpers cannot silence `odw/bounded-loop`.
- [ ] 3.2.2. Implement bounded-fan-out detection for `parallel` calls.
  - Requires steps 2.1-2.4.
  - See [technical-design.md](technical-design.md) §9.3.
  - Success: literal and args-bounded fan-out passes while unknown fan-out
    warns.
- [ ] 3.2.3. Implement completion-order control-flow warnings for
  `Promise.race`.
  - Requires steps 2.1-2.4.
  - See [technical-design.md](technical-design.md) §9.3.
  - Success: warnings include an explanation of resumability risk.
- [ ] 3.2.4. Add the heuristic rule-quality gate to each released
  orchestration rule.
  - Requires 3.2.1, 3.2.2, or 3.2.3 as appropriate.
  - See [technical-design.md](technical-design.md) §9.3.
  - Success: each heuristic has positive fixtures, negative fixtures, a
    false-positive example, a suppression/config path, and span snapshots.

### 3.3. Add configuration and warning policy

This step answers whether teams can adopt the rules without forking defaults.
It informs CI usage and later plugin integration. See
[technical-design.md](technical-design.md) §§7.2, 7.3, and 10.

- [ ] 3.3.1. Implement optional configuration loading with include, exclude,
  strictness, and rule severity settings.
  - Requires 2.4.1.
  - See [technical-design.md](technical-design.md) §§7.2 and 10.
  - Success: unknown rule identifiers fail configuration validation.
- [ ] 3.3.2. Implement `--max-warnings`.
  - Requires 3.3.1.
  - See [technical-design.md](technical-design.md) §7.3.
  - Success: the command exits code 1 when warning count exceeds the threshold.
- [ ] 3.3.3. Add pairwise CLI-mode coverage for format, strict mode, warning
  threshold, config, and stdin.
  - Requires 3.3.1 and 3.3.2.
  - See [technical-design.md](technical-design.md) §11.4.
  - Success: the highest-risk flag combinations are covered without an
    exhaustive test explosion.
- [ ] 3.3.4. Add fix-mode coverage once the first safe fix lands.
  - Requires 3.3.1 and one fixable rule.
  - See [technical-design.md](technical-design.md) §§7.0-7.4.
  - Success: tests cover `--fix`, `--fix-only`, `--diff`, `--unsafe-fixes`,
    `--show-fixes`, and `--exit-non-zero-on-fix` with Ruff-compatible exit
    behaviour.

## 4. Third vertical slice: adoption and ODW integration

Idea: if the standalone checker fits ODW's examples, CI, and future command
surface, it can become the shared static-analysis layer for multi-provider
workflow authoring instead of a side tool.

This phase turns the linter into a documented adoption path and prepares an ODW
integration point without forcing the integration before the core is stable.

### 4.1. Automate fixture drift management

This step answers whether `odw-lint` can keep its phase-2 parity corpus current
as ODW evolves. It informs release confidence and ownership boundaries. See
[technical-design.md](technical-design.md) §§11.1 and 11.2.

- [ ] 4.1.1. Add a fixture-update workflow for new ODW examples.
  - Requires steps 3.1-3.3.
  - See [technical-design.md](technical-design.md) §11.1.
  - Success: adding an ODW example requires updating expected diagnostics in
    one reviewable change.
- [ ] 4.1.2. Add drift reporting that explains which mirrored ODW behaviour
  changed when fixture updates fail.
  - Requires 4.1.1.
  - See [technical-design.md](technical-design.md) §11.2.
  - Success: drift failures identify the fixture, ODW behaviour class, and
    owning `odw-lint` rule.
- [ ] 4.1.3. Surface upstream workflow quality findings during fixture
  refreshes.
  - Requires 4.1.1.
  - Record known upstream example quality findings, including findings skipped
    to preserve snapshot fidelity, as part of the fixture-refresh workflow.
  - Success: refresh reviews show which upstream workflow risks remain
    intentionally mirrored and which should be fixed upstream before hashes
    are updated.

### 4.2. Document CI and authoring workflows

This step answers whether a workflow author can install and operate the tool
without knowing its internals. It informs the v1 release checklist. See
[technical-design.md](technical-design.md) §§7, 8, and 15.

- [ ] 4.2.1. Write user documentation for `odw-lint check`, JSON output, and
  strict Claude mode.
  - Requires steps 3.1-3.3.
  - See [technical-design.md](technical-design.md) §§7-9.
  - Success: the guide includes copy-pasteable local and CI commands.
- [ ] 4.2.2. Add a repository CI example that fails on errors and optionally
  on warnings.
  - Requires 4.2.1.
  - See [technical-design.md](technical-design.md) §§7.4 and 15.
  - Success: CI output includes text diagnostics while JSON remains available
    for tools.
- [ ] 4.2.3. Document release gates for `make all`, `make markdownlint`,
  fixture snapshots, parity tests, forbidden imports, hostile metadata, and
  span snapshots.
  - Requires steps 3.1-3.3.
  - See [technical-design.md](technical-design.md) §15.
  - Success: the release checklist matches the acceptance boundary.

### 4.3. Prepare the ODW command integration

This step answers whether ODW can call the checker as a library rather than
shelling out. It informs whether `odw check` belongs in ODW v1 integration. See
[technical-design.md](technical-design.md)
§§7.1 and 13.

- [ ] 4.3.1. Export a programmatic `checkWorkflows` API from `odw-lint`.
  - Requires steps 3.1-3.3.
  - See [technical-design.md](technical-design.md) §§5 and 13.
  - Success: the CLI uses the same API as external callers.
- [ ] 4.3.2. Prototype an ODW-side `odw check` command against the exported
  API.
  - Requires 4.3.1.
  - See [technical-design.md](technical-design.md) §7.1.
  - Success: the prototype produces equivalent diagnostics to
    `odw-lint check`.

### 4.4. Add maintainer documentation navigation

This step answers whether maintainers can navigate documentation, decision
records, execution plans, and issue audits as the roadmap accumulates
remediation work. It informs later adoption and handoff documentation. See
[documentation-style-guide.md](documentation-style-guide.md) "Standard document
types" and [developers-guide.md](developers-guide.md) "Documentation Upkeep".

- [x] 4.4.1. Add documentation contents and repository-layout scaffolding.
  - Requires 1.1.1 and 1.2.1.
  - Create `docs/contents.md` and `docs/repository-layout.md` that index
    current docs, ADRs, issue audits, execution plans, source, tests, and
    tooling responsibilities.
  - Success: maintainers can find every current documentation family and
    repository path from one canonical navigation trail without inferring
    layout from file names.

## 5. Deferred extensions

Idea: if the core v1 promise is already trustworthy and boring to operate, the
project can evaluate broader extensions on their product value instead of
letting them destabilize the main release.

The following work is intentionally outside the core v1 path.

### 5.1. Evaluate Biome and GritQL integration

This step answers whether Biome can host a subset of ODW lint rules for teams
already using Biome. See [technical-design.md](technical-design.md) §§3 and 14.

- [ ] 5.1.1. Prototype Biome GritQL snippets for simple AST-pattern
  diagnostics.
  - Requires steps 4.1-4.4.
  - See [technical-design.md](technical-design.md) §14.
  - Success: the prototype documents which rules cannot be expressed because
    they need ODW envelope semantics.

### 5.2. Evaluate Oxlint plugin integration

This step answers whether Oxlint can host AST-backed ODW rules once its JS
plugin API is suitable for the project. See
[technical-design.md](technical-design.md) §§3 and 14.

- [ ] 5.2.1. Prototype an Oxlint JS plugin for one orchestration-risk rule.
  - Requires steps 4.1-4.4.
  - See [technical-design.md](technical-design.md) §14.
  - Success: the prototype records API gaps around custom parsing, rule
    configuration, and source-span parity.

### 5.3. Evaluate editor and Rust-core paths

This step answers whether adoption now requires editor diagnostics or a
Node-free analyser. See [technical-design.md](technical-design.md) §§13 and 14.

- [ ] 5.3.1. Write an ADR for language-server support.
  - Requires steps 4.1-4.4.
  - See [technical-design.md](technical-design.md) §14.
  - Success: the ADR chooses between reusing the TypeScript core and building
    an editor-specific service.
- [ ] 5.3.2. Write an ADR for a Rust analyser core only if performance,
  distribution, or language-server constraints justify it.
  - Requires steps 4.1-4.4.
  - See [technical-design.md](technical-design.md) §§13 and 14.
  - Success: the ADR includes measurements or distribution constraints rather
    than a preference for Rust as an implementation language.
