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
  - [ ] 1.2.4.3. Add source-position validator coverage.
    - Addendum (from audit:1.5.10; low). Add direct behavioural coverage for
      `validateSourceSpan` rejection branches and `spanFromTextIndexes`
      production use. Lightweight addendum pass.

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
  - [x] 1.5.2.1. Unify branch-freshness exit-code mapping.
    - Addendum (from audit:1.5.6; medium). Route the branch-freshness CLI
      through its exported exit-code mapping so status additions cannot drift
      between tests and process behaviour. Lightweight addendum pass.
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
- [x] 1.5.6. Add independent roadmap audit review evidence gates.
  - Requires 1.5.2 and 1.5.5.
  - Add a roadmap review or audit workflow check, permission profile, or
    equivalent gate that re-runs repository gates with command execution
    enabled, reports explicit degraded-mode evidence when execution is
    unavailable, and selects an explicit fallback when the scrutineer
    dual-review path is quota-blocked.
  - Success: benchmark and audit reviews no longer rely solely on a task
    agent's self-reported gate output or silently substitute the intended
    dual-review path.
  - [x] 1.5.6.1. Make review-evidence gate timeouts configurable.
    - Addendum (from review:1.5.6; low). Add a documented flag or environment
      override for per-gate execution timeout so slow review environments do
      not produce misleading degraded evidence. Lightweight addendum pass.
  - [x] 1.5.6.2. Distinguish timed-out review-evidence gates.
    - Addendum (from review:1.5.6; low). Split timed-out or killed gate
      executions from spawn-unavailable evidence and map hung gates to
      reviewer-visible failure. Lightweight addendum pass.
  - [x] 1.5.6.3. Add deterministic CodeRabbit fallback evidence.
    - Addendum (from review:3.1.2; low). Document and test a deterministic
      offline fallback or retry policy when CodeRabbit review produces no
      usable output. Lightweight addendum pass.
- [x] 1.5.7. Invoke review evidence from the roadmap review workflow.
  - Adopt `make review-evidence` in the roadmap review or audit workflow, or
    add an equivalent scheduled smoke path, so the gate is run automatically
    instead of depending on reviewer memory.
  - Requires 1.5.6.
  - Success: a normal roadmap review or audit path records review-evidence
    output without a manual reviewer opting into the target.
- [x] 1.5.8. Derive reviewer availability from harness state.
  - Wire review-evidence reviewer availability from the roadmap or df12-build
    workflow's observed reviewer state, such as scrutineer quota or
    unavailable reviewer detection, instead of defaulting an unparameterized
    run to optimistic availability.
  - Requires 1.5.6 and 1.5.7.
  - Success: an unparameterized automated review cannot claim a scrutineer
    review when the harness knows only coderabbit or local-self-run evidence is
    available.
  - [x] 1.5.8.1. Add real review-evidence CLI smoke coverage.
    - Addendum (from review:1.5.8; low). Spawn the review-evidence CLI through
      the real Bun command path for the documented degraded, verified, and
      usage-error invocations. Lightweight addendum pass.
  - [x] 1.5.8.2. Standardize review-evidence parse result signalling.
    - Addendum (from audit:1.5.8; low). Replace mixed string failure
      conventions in review-evidence option parsing with one tagged result
      shape. Lightweight addendum pass.
  - [x] 1.5.8.3. Harden reviewer-availability unit coverage.
    - Addendum (from audit:1.5.8; low). Pin positive mappings, environment
      precedence, invalid-value handling, and immutable availability updates.
      Lightweight addendum pass.
- [x] 1.5.9. Consolidate build-gate CLI support.
  - Extract shared CLI writer, default stream, and report-dispatch support for
    build-gate command modules while preserving each gate's policy and result
    contract.
  - Requires 1.5.5 and 1.5.6.
  - Success: branch-freshness, whitespace-hygiene, and review-evidence CLIs
    consume one documented CLI-support helper before another build gate clones
    the same reviewer-facing command boilerplate.
  - [x] 1.5.9.1. Replace literal CLI seam-ownership guards.
    - Addendum (from review:1.5.9; low). Replace string-substring
      anti-duplication tests with a structural or lint-backed guard for the
      shared CLI writer seam. Lightweight addendum pass.
  - [x] 1.5.9.2. Extract default-stream test harness support.
    - Addendum (from review:1.5.9; low). Centralize stdout and stderr
      override-and-restore support for CLI default-stream tests. Lightweight
      addendum pass.
- [x] 1.5.10. Add an executable artefact check for recorded review evidence.
  - Require the roadmap review or audit path to attach or persist the
    `make review-evidence` report for each completed review or audit, and add
    a build-gate check that rejects missing recorded evidence.
  - Requires 1.5.7 and 1.5.8.
  - Success: a completed roadmap review or audit cannot claim review-evidence
    compliance unless the recorded report is available to the audit harness.
  - [x] 1.5.10.1. Add recorded-evidence report integrity checks.
    - Addendum (from review:1.5.10; low). Reject truncated or structurally
      incomplete recorded review-evidence reports instead of accepting a
      surviving status header alone. Lightweight addendum pass.
- [x] 1.5.11. Consolidate build-gate CLI run-and-exit orchestration.
  - Extract a shared run-and-exit helper for build-gate CLIs and move reviewer
    availability parsing to a table-driven shape while preserving each gate's
    report and exit-code policy.
  - Requires 1.5.8 and 1.5.9.
  - Success: branch-freshness, whitespace-hygiene, and review-evidence command
    modules share one CLI orchestration seam, and reviewer availability options
    cannot drift by path-specific parser branches.
  - [ ] 1.5.11.1. Document the shared build-gate run-and-exit seam.
    - Addendum (from review:1.5.11 and audit:1.5.11; low). Refresh the
      developers-guide `cli-support.ts` and review-evidence artefact guidance
      for `runCliEntrypoint`, exit modes, entrypoint ownership, and the
      `--evidence-path=` flag. Lightweight addendum pass.
  - [ ] 1.5.11.2. Harden entrypoint-seam process detection.
    - Addendum (from review:1.5.11; low). Extend the AST seam guard and
      discovery filter to catch named and aliased `node:process` imports that
      clone direct-execution orchestration. Lightweight addendum pass.
  - [ ] 1.5.11.3. Share entrypoint-seam AST test primitives.
    - Addendum (from audit:1.5.11; medium). Extract shared import-inspection
      helpers for CLI seam tests and fix call-expression recursion so nested
      calls are discovered. Lightweight addendum pass.
- [x] 1.5.12. Bind recorded review evidence to the reviewed tree state.
  - Extend the recorded review-evidence artefact contract so the audit harness
    can reject stale or mismatched reports from a previous run.
  - Requires 1.5.10.
  - Success: `make review-evidence-artefact` or its CLI rejects a recorded
    report when its embedded commit, tree, or equivalent provenance marker does
    not match the current reviewed state.
  - Completed: recorded review-evidence artefacts now carry reviewed commit and
    tree provenance, with the tree as the authoritative match key. The artefact
    CLI rejects missing, invalid, unbound, or tree-mismatched reports before a
    review can claim recorded evidence.
  - [x] 1.5.12.1. Document duplicate provenance-line handling.
    - Addendum (from review:1.5.12; low). Add a short
      `review-evidence-provenance` module-documentation note explaining that
      duplicate reviewed-commit or reviewed-tree trailer lines leave a report
      unbound. Lightweight addendum pass.
  - [x] 1.5.12.2. Add bound-evidence matching-trailer property coverage.
    - Addendum (from review:1.5.12; low). Add fast-check coverage proving
      complete reports with matching provenance trailers classify as present.
      Lightweight addendum pass.
  - [x] 1.5.12.3. Couple evidence recording to a clean reviewed tree.
    - Addendum (from review:1.5.12; low). Assert a clean worktree before
      recording review evidence or document the reviewer precondition beside
      provenance recording. Lightweight addendum pass.
  - [x] 1.5.12.4. Cover readTreeProvenance symmetric failures.
    - Addendum (from review:1.5.12; low). Add direct coverage for failed tree
      lookup and Git spawn-error branches in `readTreeProvenance`. Lightweight
      addendum pass.
  - [x] 1.5.12.5. Restore recording-path command-query separation.
    - Addendum (from audit:1.5.12; medium). Return a provenance-error
      discriminator from report-content building and emit diagnostics from the
      recording boundary. Lightweight addendum pass.
- [ ] 1.5.13. Finish build-gate CLI helper consolidation.
  - Lift repeated flag parsing and unknown-error formatting into shared
    build-gate CLI helpers while preserving each gate's report policy and
    output completeness.
  - Requires 1.5.10 and 1.5.11.
  - Success: build-gate CLIs share one `parseFlagValue` and one unknown-error
    formatter where their contracts match, and the shared run-and-exit path
    preserves full review-evidence output without truncation.
- [ ] 1.5.14. Unify build-gate Git command failure helpers.
  - Requires 1.5.12 and 1.5.13.
  - Share the Git command renderer and Git failure-message formatter used by
    `git-support.ts` and review-evidence provenance while leaving
    feature-specific policy at each gate.
  - Success: build-gate Git callers use one documented command and
    failure-formatting helper where their contracts match, and existing
    branch-freshness, whitespace, and review-evidence diagnostics stay
    complete.

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
- [x] 2.1.5. Add the hostile metadata security regression test.
  - Requires 1.3.4 and 2.1.3.
  - See [technical-design.md](technical-design.md) §11.3.
  - Success: linting hostile metadata leaves no side effect marker.
  - Completion note: `tests/static-analysis/hostile-metadata-security.test.ts`
    now lints every hostile-metadata fixture through the real
    `scanWorkflowEnvelope` and `classifyWorkflowMetadata` path and through the
    public `odw-lint` entry in a fresh module graph, asserting exact diagnostics
    with no hostile side effect marker.
  - [x] 2.1.5.1. Extract structured cold-module-graph import-safety helpers.
    - Addendum (from review:2.1.5; low). Centralize the duplicated
      fresh-module-graph spawn guard for hostile metadata and fixture refresh
      tests, with typed script construction and structured failure output.
      Lightweight addendum pass.
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
  - [x] 2.1.6.3. Add failing and fixed rule-reference examples.
    - Addendum (from audit:2.1.5; low). Add concrete failing-then-fixed
      examples to released rule documentation pages, reusing invalid workflow
      fixtures where they improve reviewability. Lightweight addendum pass.
  - [x] 2.1.6.4. Centralize catalogue rule and message lookup helpers.
    - Addendum (from audit:2.2.1; medium). Move repeated rule-definition and
      first-message access behind diagnostics-layer helpers before
      parser-backed diagnostics multiply catalogue access patterns.
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
- [x] 2.1.8. Define diagnostic message templates for parser-backed rules.
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
  - [x] 2.1.8.1. Brand diagnostic message templates.
    - Addendum (from review:2.1.8; low). Make `MessageTemplate` opaque so
      render and match helpers only accept templates that passed
      `createMessageTemplate`. Lightweight addendum pass.
  - [x] 2.1.8.2. Cache and harden message-template matching.
    - Addendum (from review:2.1.8; medium). Memoize compiled match regexes and
      add candidate length or placeholder-complexity guards before dynamic
      parser detail reaches this path. Lightweight addendum pass.
  - [x] 2.1.8.3. Single-source message-template tokenization.
    - Addendum (from audit:2.1.8; low). Build rendering and matching from one
      placeholder token stream so the `{name}` grammar cannot diverge.
      Lightweight addendum pass.
  - [x] 2.1.8.4. Document the public message-template contract.
    - Addendum (from audit:2.1.8; medium). Document the placeholder grammar,
      render requirements, and matching semantics for rule authors. Lightweight
      addendum pass.
  - [x] 2.1.8.5. Own the reviewed rule message contract in production.
    - Addendum (from audit:2.2.5; medium). Promote the exact-or-template
      message-contract predicate from tests into the diagnostics catalogue for
      future validators and editor integrations. Lightweight addendum pass.
- [x] 2.1.9. Split source-mask token scanners into focused modules.
  - Requires 2.1.1.
  - Addendum source: audit:2.1.7; medium.
  - Separate comment, string, template, regex, and delimiter masking helpers so
    future envelope and AST-fact work extends focused scanners instead of a
    near-limit production file.
  - Success: the source-mask facade preserves current masking behaviour, each
    token family has a named implementation home, and existing masking fixture
    and property tests remain green.
  - [x] 2.1.9.1. Consolidate string delimiter classification.
    - Addendum (from audit:2.1.5; medium). Move duplicated string-delimiter
      predicates into `source-mask-delimiters.ts` so token scanners share the
      documented delimiter source of truth. Lightweight addendum pass.
  - [x] 2.1.9.2. Unify regex-literal scanning across mask modules.
    - Addendum (from audit:2.2.6; medium). Share the regex-body scanner used
      by statement-level and template-expression masking without changing
      masking behaviour. Lightweight addendum pass.
- [x] 2.1.10. Canonicalize diagnostic rule documentation link contracts.
  - Requires 2.1.6.
  - Addendum source: audit:2.1.7; medium.
  - Choose one emitted documentation-link shape for rule diagnostics and update
    catalogue, schema, docs, and tests before text and JSON reporters expose the
    field to downstream integrations.
  - Success: diagnostic metadata exposes one tested rule-documentation reference
    format and no code or docs describe a competing URL/path shape.
  - [x] 2.1.10.1. Add a shared rule diagnostic builder.
    - Addendum (from audit:3.1.2; medium). Add one diagnostics-layer rule
      diagnostic builder that derives docs paths from the catalogue and migrate
      hand-rolled rule diagnostics onto it. Lightweight addendum pass.
- [x] 2.1.11. Broaden hostile metadata side-effect fixtures.
  - Requires 1.3.5 and 2.1.5.
  - Add at least one filesystem-write or environment-read hostile metadata
    fixture through the refresh tooling, updating hashes, spans, snapshots, and
    fixture-count guards without evaluating fixture source.
  - Success: the hostile metadata regression exercises global-write,
    thrown-marker, and filesystem or environment side-effect observables while
    fixture refresh output remains deterministic.
- [x] 2.1.12. Introduce a static workflow lint entry point.
  - Requires 2.1.3, 2.1.5, and 2.1.7.
  - Add a production `lintWorkflowSource` entry point that owns the merge of
    envelope-scan and metadata-classification diagnostics before the `check`
    command consumes the static loader boundary.
  - Success: tests and future CLI work consume one call that emits complete
    envelope and metadata diagnostics without reimplementing merge order.
  - [x] 2.1.12.1. Add a static-analysis module-inventory guard.
    - Addendum (from review:2.1.12; low). Add a readdir-based module
      inventory guard for `src/static-analysis/`, parallel to the diagnostics
      inventory guard, so static-analysis modules cannot be added or removed
      without an explicit reviewed fixture update. Lightweight addendum pass.
  - [x] 2.1.12.2. Strengthen workflow-lint merge-order properties.
    - Addendum (from review:2.1.12; low). Replace the fixed-string
      `lintWorkflowSource` merge-order property with a structural source
      generator that composes metadata prefixes, import or export edges, and
      invalid-name variants. Lightweight addendum pass.
  - [x] 2.1.12.3. Decide the static-analysis result freeze-depth contract.
    - Addendum (from review:2.1.12 and audit:2.1.12; low). Decide whether
      static-analysis and diagnostic result objects are deep-frozen runtime
      values or readonly compile-time data, then document and enforce the
      chosen contract consistently. Lightweight addendum pass.
  - [x] 2.1.12.4. Consolidate identifier-character classification.
    - Addendum (from audit:2.1.12; medium). Move static-analysis identifier
      start and part predicates onto one spec-correct, ZWNJ/ZWJ-aware helper
      and add a boundary regression fixture for joiner-bearing identifiers.
      Lightweight addendum pass.
  - [x] 2.1.12.5. Extract shared low-level scanner character predicates.
    - Addendum (from audit:2.1.12; low). Centralize the remaining
      string-delimiter and whitespace predicates used by the workflow-metadata
      and source-mask scanner families, then remove duplicated local helpers.
      Lightweight addendum pass.
  - [x] 2.1.12.6. Share workflow body parsing in the lint pipeline.
    - Addendum (from review:3.1.2 and audit:3.1.2; medium). Wire
      `odw/body-syntax` diagnostics into `lintWorkflowSource` through one
      normalized body parse shared with Claude-compatibility detection while
      preserving each failure policy. Lightweight addendum pass.
  - [x] 2.1.12.7. Add live-pipeline diagnostic docs coverage.
    - Addendum (from audit:3.1.2; medium). Assert that `lintWorkflowSource`
      emitted diagnostics carry catalogue-derived docs paths across invalid
      fixtures and rule parity coverage. Lightweight addendum pass.
  - [x] 2.1.12.8. Complete low-level scanner predicate centralization.
    - Addendum (from audit:2.2.7; medium). Finish the 2.1.12.5 predicate pass
      by promoting string-like delimiters to one type guard and replacing
      remaining local whitespace and ASCII identifier idioms. Lightweight
      addendum pass.
- [x] 2.1.13. Extract a shared scanner primitive layer.
  - Consolidate the low-level source-scanning primitives shared by source-mask
    and workflow-metadata scanners, including identifier runs, delimiter walks,
    escapes, and token-boundary helpers, without changing emitted diagnostics or
    mask ranges.
  - Requires 2.1.9 and 2.1.12.8.
  - See [technical-design.md](technical-design.md) §6.2.
  - Success: source-mask and workflow-metadata scanner families consume one
    documented primitive layer for their shared JavaScript token grammar, with
    focused tests proving existing masking and metadata extraction behaviour is
    unchanged.
  - [x] 2.1.13.1. Complete scanner delimiter-depth primitive consolidation.
    - Addendum (from audit:1.5.12; low). Unify delimiter-depth folding so
      scanner families clamp unbalanced delimiters consistently. Lightweight
      addendum pass.
  - [x] 2.1.13.2. Reconcile primitive interface notes.
    - Addendum (from review:2.1.13; low). Align the ExecPlan interface notes
      with the shipped `identifierRunEnd` return contract. Lightweight
      addendum pass.
  - [x] 2.1.13.3. Add delimited-oracle provenance checks.
    - Addendum (from review:2.1.13; low). Pin parity-oracle provenance or fold
      faithfulness into behaviour fixtures so hand-frozen delimited-end oracles
      cannot drift. Lightweight addendum pass.
  - [x] 2.1.13.4. Enrich scanner primitive boundary coverage.
    - Addendum (from review:2.1.13; low). Add table-driven primitive boundary
      cases for line-comment terminators, bounded block comments, and nested
      template-expression paths. Lightweight addendum pass.
  - [x] 2.1.13.5. Reconcile comment scanner wrapper naming.
    - Addendum (from audit:2.1.13; low). Standardize `scanLineCommentEnd`
      wrapper ownership or direct primitive imports so scanner families cannot
      expose divergent same-name semantics. Lightweight addendum pass.
- [x] 2.1.14. Consolidate delimited and balanced scanner loops.
  - Share one parametrized delimited-region primitive, and where contracts
    match one balanced-expression primitive, across escaped-delimited scanners,
    template-expression scans, metadata parsing, and parity oracles without
    changing emitted diagnostics or mask ranges.
  - Requires 2.1.13.
  - Success: source-mask and workflow-metadata scanners no longer carry forked
    escaped-delimited or balanced-expression loops, parity or provenance tests
    prove behaviour unchanged, and `source-scanner-primitives.ts` remains the
    documented scanner seam.
  - [x] 2.1.14.1. Broaden scanner parity generators.
    - Addendum (from review:2.1.14; low). Broaden scanner parity generators
      with paragraph separators, exotic whitespace, delimiter interplay, and
      deeper nested-template fragments. Lightweight addendum pass.
  - [x] 2.1.14.2. Fold template-literal scanning onto shared walkers.
    - Addendum (from audit:2.1.14; medium). Let template-literal masking
      delegate matched region-walk backbones while preserving regex handling.
      Lightweight addendum pass.
  - [x] 2.1.14.3. Unify scanner regex-start heuristics.
    - Addendum (from audit:2.1.14; medium). Share one preceding-token
      regex-start predicate across top-level and template scanners with parity
      coverage. Lightweight addendum pass.

### 2.2. Normalize and parse workflow bodies with SWC

This step answers whether ODW's top-level body can be represented as parseable
source without losing span fidelity. It informs all later AST rules. See
[technical-design.md](technical-design.md) §§6.1 and 11.5.

- [x] 2.2.1. Add `@swc/core` and implement the parser adapter.
  - Requires 2.1.2 and 2.1.8.
  - See [technical-design.md](technical-design.md) §§4 and 6.1.
  - Success: body syntax errors become `odw/body-syntax` diagnostics rather
    than thrown exceptions.
- [x] 2.2.2. Implement body normalization for top-level `return` and
  `await`.
  - Requires 2.2.1.
  - See [technical-design.md](technical-design.md) §§4 and 6.1.
  - Success: ODW examples containing top-level `return` and `await` parse with
    original-source span mapping.
- [x] 2.2.3. Add span snapshot assertions for parser-backed diagnostics.
  - Requires 2.2.2.
  - See [technical-design.md](technical-design.md) §11.5.
  - Success: each body diagnostic includes a stable original-source snippet
    across LF, CRLF, Unicode, comments, regex literals, template text, and
    template interpolation.
- [x] 2.2.4. Implement workflow AST facts for lexical bindings and source
  masks.
  - Requires 2.1.9 and 2.2.2.
  - See [technical-design.md](technical-design.md) §§6.2 and 9.3.
  - Provide binding facts for global-helper shadowing and original-source
    comment or literal masks for suppression parsing.
  - Success: rule tests can distinguish JavaScript globals from shadowed
    `parallel`, `Array`, `Number`, `Object`, and `Math` identifiers, and
    directive-like text in strings, templates, regexes, and block comments is
    ignored.
- [x] 2.2.5. Adopt message templates in the first parser-backed rule.
  - Requires 2.1.8 and 2.2.1.
  - Render the first dynamic parser diagnostic through a catalogue-owned
    reviewed message template, and exercise the template branch of invalid
    fixture parity through real parser detail.
  - Success: a parser-backed fixture diagnostic matches `ruleAllowsMessage`
    through a reviewed template rather than an exact-only or substring
    assertion.
  - Completion note: `odw/body-syntax` now renders SWC syntax details through
    the reviewed `{detail}` message template while retaining the exact
    no-detail fallback, and syntax-error fixture parity exercises the template
    branch.
  - [x] 2.2.5.1. Harden body-syntax detail marker stripping.
    - Addendum (from review:2.2.5; low). Prevent marker stripping from
      removing legitimate leading `x` or `X` tokens in future parser detail.
      Lightweight addendum pass.
  - [x] 2.2.5.2. Document SWC-bump parser-detail recapture.
    - Addendum (from review:2.2.5; low). Add maintainer guidance to
      re-observe pinned SWC syntax details, manifests, and parser snapshots on
      parser upgrades. Lightweight addendum pass.
- [x] 2.2.6. Narrow body-syntax spans when parser offsets are structured.
  - Requires 2.2.3.
  - Revisit the SWC parser adapter, or an equivalent parser error channel, once
    it exposes stable syntax-error byte offsets, and map
    `odw/body-syntax` diagnostics from the whole body to the offending token
    without parsing rendered diagnostic prose.
  - Success: parser-backed syntax diagnostics still use original-source spans,
    and a structured-offset fixture proves the span narrows to the failure
    token without weakening the fallback for parsers that expose no offset.
  - Completed by [roadmap-2-2-6.md](execplans/roadmap-2-2-6.md).
  - [x] 2.2.6.1. Guard parser-error offset coordinate bases.
    - Addendum (from review:2.2.6; medium). Reject or normalize parser-error
      offsets unless their coordinate base is explicit, including scalar caret
      offsets that need token-end synthesis. Lightweight addendum pass.
  - [x] 2.2.6.2. Reconcile the span-narrowing public surface.
    - Addendum (from audit:2.2.6; medium). Document the current pinned-parser
      inert status, trim speculative exports, and align characterization tests
      with production consumption. Lightweight addendum pass.
  - [x] 2.2.6.3. Consolidate parser-range type guards.
    - Addendum (from audit:2.2.5; medium). Move duplicated low-level
      static-analysis object and number guards into one reviewed helper used
      by parser-range code and tests. Lightweight addendum pass.
  - [x] 2.2.6.4. Isolate body-parser span narrowing and UTF-8 byte-length
    helpers.
    - Addendum (from audit:2.2.7; low). Move inert span-narrowing machinery
      behind a focused internal module and share one UTF-8 byte-length
      primitive. Lightweight addendum pass.
- [x] 2.2.7. Reconcile workflow-body parser dialect scope.
  - Requires 2.2.1, 2.2.5, and 2.2.6.
  - Decide whether workflow bodies are parsed as ECMAScript-only source or
    supported TypeScript syntax, then align diagnostics and documentation with
    that decision.
  - Success: TypeScript-in-body input has an intentional, tested outcome, and
    roadmap, design, developer, and rule documentation no longer describe a
    broader parser dialect than production accepts.
  - Completed by [roadmap-2-2-7.md](execplans/roadmap-2-2-7.md).
  - [x] 2.2.7.1. Add explicit SWC-bump dialect re-observation guidance.
    - Addendum (from review:2.2.7; low). Tie intentional `@swc/core` bumps to
      rerunning the workflow-body dialect test and preserving ADR 0002's
      TypeScript-in-body rejection set. Lightweight addendum pass.

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
- [ ] 2.3.4. Characterize ODW loader rejection of TypeScript-only workflow body
  syntax.
  - Use the loader-parity harness or a documented trusted probe to confirm
    ODW's Function or AsyncFunction body-compilation path rejects the ADR 0002
    TypeScript-only body examples.
  - Requires 2.2.7 and 2.3.1.
  - Success: loader-parity evidence proves `odw-lint`'s `odw/body-syntax`
    outcome for TypeScript-only bodies matches the current ODW loader, or
    records a deliberate parity divergence for design review.

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
- [x] 3.1.2. Implement deterministic-time and randomness warnings for
  `Date.now()`, `Math.random()`, and arg-less `new Date()`.
  - Requires 2.2.2.
  - See [technical-design.md](technical-design.md) §9.2.
  - Success: warnings match ODW's `scanDualCompat` behaviour for trusted
    fixtures.
  - [x] 3.1.2.1. Snapshot intra-expression deterministic-time ordering.
    - Addendum (from review:3.1.2; low). Add deterministic-time fixtures that
      pin intra-expression hazard source order, including mixed
      `Math.random()`, `Date.now()`, and nested `new Date(Date.now())` cases.
      Lightweight addendum pass.
- [ ] 3.1.3. Implement `--strict-claude` severity promotion.
  - Requires 3.1.1 and 3.1.2.
  - See [technical-design.md](technical-design.md) §§7.3 and 9.2.
  - Success: strict mode exits non-zero for Claude compatibility warnings.
- [x] 3.1.4. Apply lexical-binding facts to deterministic-time compatibility
  detection.
  - Requires 2.2.4 and 3.1.2.
  - Revisit `Date` and `Math` matching once workflow AST facts can distinguish
    globals, shadowed bindings, computed members, and `globalThis` member
    chains, and document how the same facts feed later orchestration-rule
    hardening.
  - Success: Claude compatibility warnings ignore locally shadowed `Date` or
    `Math` bindings while detecting supported global `Date.now`,
    `Math.random`, arg-less `new Date`, computed `Date["now"]()`, and
    `globalThis.Date.now()` forms with original-source spans.
  - [x] 3.1.4.1. Harden deterministic-time syntactic escape handling.
    - Addendum (from review:3.1.4; low). Add bounded alias and optional-chain
      coverage for common deterministic-time forms while keeping dynamic
      computed keys inside documented no-eval limits. Lightweight addendum
      pass.
  - [x] 3.1.4.2. Pin global-object resolver unit coverage.
    - Addendum (from audit:3.1.4; medium). Add focused
      `workflow-global-object-reference` tests and trim unreachable
      TypeScript-only wrapper branches under the ECMAScript parser dialect.
      Lightweight addendum pass.
- [x] 3.1.5. Add scope-precise deterministic-time shadowing.
  - Requires 2.2.4 and 3.1.4.
  - Refine lexical binding lookups for `Date`, `Math`, and `globalThis` so
    deterministic-time rules suppress only references shadowed at the use site
    rather than whole-body same-name matches.
  - Success: fixtures prove same-name bindings in unrelated scopes no longer
    hide supported Claude compatibility warnings, while local shadows remain
    suppressed.
  - [x] 3.1.5.1. Add block/for/catch-precise deterministic-time shadowing.
    - Addendum (from review:3.1.5; low). Narrow block, `for`, and `catch`
      shadow attribution for deterministic-time rules so sibling-block global
      uses no longer disappear behind conservative function-scope suppression.
      Lightweight addendum pass.
  - [x] 3.1.5.2. Add direct scope-view unit coverage.
    - Addendum (from audit:3.1.5; low). Add focused `workflow-ast-scopes`
      coverage for nested parameters, setter params, named class-expression
      member scope, and documented block-to-function attribution. Lightweight
      addendum pass.
  - [x] 3.1.5.3. Correct deterministic-time shadowing limitation docs.
    - Addendum (from audit:3.1.6; medium). Remove stale block, `for`, and
      `catch` shadowing limitations from deterministic-time rule pages after
      3.1.5.1 made those scopes precise. Lightweight addendum pass.
- [x] 3.1.6. Extend deterministic-time alias resolution to lexical scopes.
  - Requires 3.1.5.
  - Make deterministic-time alias declaration and alias-use resolution use the
    same lexical scope model as bare `Date`, `Math`, and `globalThis` roots for
    aliases such as `const now = Date.now; now()` and
    `const D = Date; D.now()`.
  - Success: same-named aliases or global roots in unrelated scopes no longer
    suppress supported Claude compatibility warnings, while aliases shadowed at
    the use site remain suppressed and rule-doc limitations are updated.
  - [x] 3.1.6.1. Document deliberate initializer dropping in scope recursion.
    - Addendum (from review:3.1.6; low). Add a brief code comment explaining
      why nested parameter and pattern recursion discards simple initializers
      while collecting owned scope facts. Lightweight addendum pass.
  - [x] 3.1.6.2. Split near-limit alias and scope-view helpers.
    - Addendum (from review:3.1.6; low). Move alias or scope-view helper code
      out of `workflow-ast-scopes.ts` before the file-size guard forces a split
      during unrelated rule work. Lightweight addendum pass.
  - [x] 3.1.6.3. Document whole-scope alias and temporal dead-zone limits.
    - Addendum (from review:3.1.6; low). State in deterministic-time rule
      limitations that alias visibility is conservative within one scope and
      does not model declaration order or temporal dead zones. Lightweight
      addendum pass.
  - [x] 3.1.6.4. Add block/for/catch alias-scope regression tests.
    - Addendum (from audit:3.1.6; low). Pin alias visibility for block, `for`,
      and `catch` scopes before later collector work changes the same scope
      model. Lightweight addendum pass.

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
- [x] 3.2.5. Consolidate SWC AST guard and traversal helpers.
  - Requires 2.2.4 and 3.1.4.
  - Extract one reviewed `isAstNode` guard, object-record guard reuse, and
    child-traversal primitive for parser-backed rules while preserving existing
    deterministic-time behaviour.
  - Success: deterministic-time and AST-fact traversals consume one documented
    SWC-shape helper seam, with tests pinning existing traversal coverage and
    no rule output changes.
  - [x] 3.2.5.1. Fix deterministic-time alias detection inside call and `new`
    arguments.
    - Addendum (from audit:3.2.5; medium). Add the missing non-node
      argument-wrapper record branch to alias collection and cover call or
      `new` argument-scoped IIFE alias regressions. Lightweight addendum pass.
  - [x] 3.2.5.2. Guard parser-backed rules against bypassing the SWC seam.
    - Addendum (from review:3.2.5; low). Add a focused architecture or
      documentation guard so new parser-backed 3.2 rules consume `swc-ast.ts`
      instead of cloning shape helpers. Lightweight addendum pass.
  - [x] 3.2.5.3. Unify single-type SWC node narrowers.
    - Addendum (from audit:3.2.6; low). Move duplicated single-type
      `isExpression`, `isMemberExpression`, and `isIdentifier` narrowers behind
      the `swc-ast.ts` seam where their contracts match. Lightweight addendum
      pass.
  - [x] 3.2.5.4. Harden single-type SWC narrower seam guards.
    - Addendum (from audit:3.2.7; medium). Replace the narrow architecture
      allowlist with shape-based cloned-narrower detection and fold the
      scope-own-facts `isExpression` copy back onto `swc-ast.ts`. Lightweight
      addendum pass.
- [x] 3.2.6. Complete SWC traversal-driver adoption for parser-backed
  collectors.
  - Requires 3.2.5, 3.1.5, and 3.2.5.1.
  - See [technical-design.md](technical-design.md) §§6.1 and 9.3.
  - Audit current deterministic-time, alias, scope, and binding collectors for
    shared traversal-driver fit; extract one driver only where it preserves
    their distinct recursion policies; and document any intentional exceptions.
  - Success: every parser-backed collector either consumes the documented SWC
    traversal seam or has a tested rationale for a distinct traversal policy,
    with no deterministic-time or AST-fact output changes.
  - [x] 3.2.6.1. Harden the traversal-seam architecture guard.
    - Addendum (from review:3.2.6; low). Pin `traverseAstSubtree` to
      `swc-ast.ts` with a positive assertion and broaden the guard so
      renamed, non-importing, or structurally cloned traversal drivers cannot
      bypass the seam. Lightweight addendum pass.
  - [x] 3.2.6.2. Centralize shared AST binding collector helpers.
    - Addendum (from audit:3.2.6; medium). Move duplicated body-extraction and
      identifier helper logic from the binding and scope collectors into the
      shared binding-pattern support where ownership fits. Lightweight addendum
      pass.
- [x] 3.2.7. Reconcile scope-owned facts with public binding facts.
  - Requires 3.1.6 and 3.2.6.
  - Remove duplicate `scopeOwnFacts` collection across binding and alias scope
    entry, and align the public flat lexical-binding facts with the scope model
    used by parser-backed rules where their contracts should match.
  - Success: scope-owned facts are computed once per scope-opening node for
    rule collectors, object-literal accessor handling no longer diverges
    between public and internal binding facts, and existing deterministic-time
    diagnostics remain unchanged.
  - [x] 3.2.7.1. Retire or document scope-entry wrappers.
    - Addendum (from audit:3.2.7; low). Remove the orphaned node-taking
      `enterScope` and `enterAliasScope` wrappers, or explicitly document them
      as tested standalone helper entry points. Lightweight addendum pass.
  - [x] 3.2.7.2. Link binding collector node-type enumerations.
    - Addendum (from audit:3.2.7; low). Add a shared classification or parity
      check tying flat binding collector node types to scope-owned
      function-like node types where their contracts should match. Lightweight
      addendum pass.
  - [x] 3.2.7.3. Add cross-model binding-fact invariant coverage.
    - Addendum (from review:3.2.7; low). Add invariant coverage proving public
      flat binding facts and the scope-owned model agree on collected
      parameter names across generated function-like and accessor bodies.
      Lightweight addendum pass.

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
  - [x] 4.4.1.1. Refresh build-gate repository-layout guidance.
    - Addendum (from audit:1.5.6; low). Update the canonical layout guide so
      `tests/build-gate/` and `git-support.ts` cover generalized build gates
      and the review-evidence target. Lightweight addendum pass.
  - [x] 4.4.1.2. Add a documentation-index freshness gate.
    - Addendum (from audit:2.2.6; low). Check the canonical documentation
      index against current ExecPlans and issue audits so navigation cannot
      drift silently. Lightweight addendum pass.
  - [x] 4.4.1.3. Document source-scanner primitives in the layout guide.
    - Addendum (from audit:2.1.13; low). Add
      `source-scanner-primitives.ts`, its scanner-family consumers, and its
      no-domain-import rule to `docs/repository-layout.md`. Lightweight
      addendum pass.
  - [x] 4.4.1.4. Document scanner regions and wrapper conventions.
    - Addendum (from audit:2.1.14; low). Add
      `source-scanner-regions.ts` and primitive wrapper-versus-direct-import
      guidance to `docs/repository-layout.md`. Lightweight addendum pass.

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
