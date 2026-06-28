# odw-lint roadmap

This roadmap sequences the work described in
[terms-of-reference.md](terms-of-reference.md) and
[technical-design.md](technical-design.md). It follows the GIST alignment:
phases state ideas, steps pursue workstreams that validate or falsify those
ideas, and tasks are review-sized execution units.

The roadmap makes no date or duration commitments. It assumes implementation
will proceed in the existing Bun and TypeScript repository, with static-boundary
decisions captured in [adr](adr/) before code relies on them.

## 1. Foundational phase: static workflow contract

Idea: if `odw-lint` settles its static workflow model, diagnostic contract, and
fixture corpus before adding broad rules, later slices can focus on useful
workflow feedback rather than reworking parser and reporter boundaries.

This phase proves that an ODW workflow can be analysed without executing
source and that diagnostics can point back to the original file.

### 1.1. Ratify the static-analysis and packaging boundary

This step records that `odw-lint` owns an SWC-based static parser for v1 and
ships the standalone `odw-lint check` command. The command is path/glob-first;
ODW-style name resolution and any `odw check` subcommand are deferred to future
ODW integration. This decision informs command naming, package exports, fixture
ownership, and integration tests. See [technical-design.md](technical-design.md)
§§5, 7 and 13, and
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
- [ ] 1.2.2. Implement line-index and source-span helpers for original files.
  - See [technical-design.md](technical-design.md) §§6.1 and 11.5.
  - Success: offsets, lines, columns, and snippets round-trip for fixtures
    with LF, CRLF, Unicode, and trailing-newline variants.
- [ ] 1.2.3. Split the diagnostic contract into focused modules.
  - Requires 1.2.1.
  - Move diagnostic types, rule-id parsing, report helpers, text formatting,
    and schema construction behind focused internal modules while preserving
    the explicit package entry point.
  - Success: the public API remains importable through `odw-lint`, and each
    diagnostic responsibility has one named module before parser, CLI, and
    rule-engine responsibilities land.

### 1.3. Establish the workflow fixture corpus

This step answers whether the linter has enough representative source to
detect regressions. The fixture corpus informs loader parity, rule behaviour,
and future ODW integration. See [technical-design.md](technical-design.md)
§11.1.

- [ ] 1.3.1. Import ODW example workflows as read-only fixture snapshots.
  - See [technical-design.md](technical-design.md) §11.1.
  - Success: every fixture records expected "no error" status before any rule
    broadening.
- [ ] 1.3.2. Add invalid fixture families for missing metadata, malformed
  metadata, unsupported imports or exports, and syntax errors.
  - See [technical-design.md](technical-design.md) §§9.1 and 11.1.
  - Success: each invalid fixture has expected rule identifiers and source
    spans.
- [ ] 1.3.3. Add masking fixtures with decoy workflow syntax inside comments,
  strings, regex literals, and template literals.
  - See [technical-design.md](technical-design.md) §§6.2 and 11.1.
  - Success: decoy syntax does not produce envelope diagnostics.
- [ ] 1.3.4. Add hostile metadata fixtures that would leave an observable side
  effect if evaluated.
  - See [technical-design.md](technical-design.md) §§11.1 and 11.3.
  - Success: the fixture produces diagnostics and no side-effect marker.

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

- [ ] 2.1.1. Implement a source masker for comments, strings, template
  literals, and regex literals.
  - Requires steps 1.1-1.3.
  - See [technical-design.md](technical-design.md) §§5 and 6.2.
  - Success: masking fixtures from 1.3.3 do not affect meta extraction.
- [ ] 2.1.2. Implement static `export const meta` extraction and unsupported
  import/export detection.
  - Requires 2.1.1.
  - See [technical-design.md](technical-design.md) §§6.2 and 9.1.
  - Success: valid ODW examples pass envelope scanning and invalid import or
    export fixtures fail with exact spans.
- [ ] 2.1.3. Implement metadata classification for runtime-invalid,
  statically unprovable, and Claude-incompatible cases.
  - Requires 2.1.2.
  - See [technical-design.md](technical-design.md) §§6.3 and 9.1.
  - Success: computed metadata receives `odw/meta-statically-unprovable`
    rather than being executed or collapsed into an ordinary ODW-invalid
    diagnostic.
- [ ] 2.1.4. Add a forbidden-import architecture test for production code.
  - Requires 1.1.1.
  - See [technical-design.md](technical-design.md) §§5 and 11.3.
  - Success: production modules cannot import executable ODW loader,
    primitive, runtime launcher, or worker paths.
- [ ] 2.1.5. Add the hostile metadata security regression test.
  - Requires 1.3.4 and 2.1.3.
  - See [technical-design.md](technical-design.md) §11.3.
  - Success: linting hostile metadata leaves no side-effect marker.
- [ ] 2.1.6. Introduce the typed rule catalogue and rule-doc parity checks.
  - Requires 1.2.1.
  - Store rule identifiers, categories, default severities, docs slugs, and
    release status in one production catalogue before envelope diagnostics
    broaden.
  - Success: released rule identifiers, default severities, configuration
    keys, and `docs/rules/` pages are checked against the catalogue.

### 2.2. Normalize and parse workflow bodies with SWC

This step answers whether ODW's top-level body can be represented as parseable
source without losing span fidelity. It informs all later AST rules. See
[technical-design.md](technical-design.md) §§6.1 and 11.5.

- [ ] 2.2.1. Add `@swc/core` and implement the parser adapter.
  - Requires 2.1.2.
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

### 2.4. Ship the minimal `check` command

This step answers whether the checker can run as a normal repository gate.
It unlocks CI adoption and user feedback. See
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
  - Requires 1.2.1 and 2.4.1.
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
  - Requires phase 2.
  - See [technical-design.md](technical-design.md) §9.3.
  - Success: the bounded ODW `loop-until-dry` example passes while an
    unbounded dispatch loop fixture warns.
- [ ] 3.2.2. Implement bounded-fan-out detection for `parallel` calls.
  - Requires phase 2.
  - See [technical-design.md](technical-design.md) §9.3.
  - Success: literal and args-bounded fan-out passes while unknown fan-out
    warns.
- [ ] 3.2.3. Implement completion-order control-flow warnings for
  `Promise.race`.
  - Requires phase 2.
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

This phase turns the linter into a documented adoption path and prepares an
ODW integration point without forcing the integration before the core is
stable.

### 4.1. Automate fixture drift management

This step answers whether `odw-lint` can keep its phase-2 parity corpus current
as ODW evolves. It informs release confidence and ownership boundaries. See
[technical-design.md](technical-design.md) §§11.1 and 11.2.

- [ ] 4.1.1. Add a fixture-update workflow for new ODW examples.
  - Requires phase 3.
  - See [technical-design.md](technical-design.md) §11.1.
  - Success: adding an ODW example requires updating expected diagnostics in
    one reviewable change.
- [ ] 4.1.2. Add drift reporting that explains which mirrored ODW behaviour
  changed when fixture updates fail.
  - Requires 4.1.1.
  - See [technical-design.md](technical-design.md) §11.2.
  - Success: drift failures identify the fixture, ODW behaviour class, and
    owning `odw-lint` rule.

### 4.2. Document CI and authoring workflows

This step answers whether a workflow author can install and operate the tool
without knowing its internals. It informs the v1 release checklist. See
[technical-design.md](technical-design.md) §§7, 8, and 15.

- [ ] 4.2.1. Write user documentation for `odw-lint check`, JSON output, and
  strict Claude mode.
  - Requires phase 3.
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
  - Requires phase 3.
  - See [technical-design.md](technical-design.md) §15.
  - Success: the release checklist matches the acceptance boundary.

### 4.3. Prepare the ODW command integration

This step answers whether ODW can call the checker as a library rather than
shelling out. It informs whether `odw check` belongs in ODW v1 integration.
See [technical-design.md](technical-design.md) §§7.1 and 13.

- [ ] 4.3.1. Export a programmatic `checkWorkflows` API from `odw-lint`.
  - Requires phase 3.
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

- [ ] 4.4.1. Add documentation contents and repository-layout scaffolding.
  - Requires 1.1.1 and 1.2.1.
  - Create `docs/contents.md` and `docs/repository-layout.md` that index
    current docs, ADRs, issue audits, execution plans, source, tests, and
    tooling responsibilities.
  - Success: maintainers can find every current documentation family and
    repository path from one canonical navigation trail without inferring
    layout from file names.

## 5. Deferred extensions

Idea: if the core v1 promise is already trustworthy and boring to operate,
the project can evaluate broader extensions on their product value instead of
letting them destabilize the main release.

The following work is intentionally outside the core v1 path.

### 5.1. Evaluate Biome and GritQL integration

This step answers whether Biome can host a subset of ODW lint rules for teams
already using Biome. See [technical-design.md](technical-design.md) §§3 and
14.

- [ ] 5.1.1. Prototype Biome GritQL snippets for simple AST-pattern
  diagnostics.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §14.
  - Success: the prototype documents which rules cannot be expressed because
    they need ODW envelope semantics.

### 5.2. Evaluate Oxlint plugin integration

This step answers whether Oxlint can host AST-backed ODW rules once its JS
plugin API is suitable for the project. See
[technical-design.md](technical-design.md) §§3 and 14.

- [ ] 5.2.1. Prototype an Oxlint JS plugin for one orchestration-risk rule.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §14.
  - Success: the prototype records API gaps around custom parsing, rule
    configuration, and source-span parity.

### 5.3. Evaluate editor and Rust-core paths

This step answers whether adoption now requires editor diagnostics or a
Node-free analyser. See [technical-design.md](technical-design.md) §§13 and
14.

- [ ] 5.3.1. Write an ADR for language-server support.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §14.
  - Success: the ADR chooses between reusing the TypeScript core and building
    an editor-specific service.
- [ ] 5.3.2. Write an ADR for a Rust analyser core only if performance,
  distribution, or language-server constraints justify it.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §§13 and 14.
  - Success: the ADR includes measurements or distribution constraints rather
    than a preference for Rust as an implementation language.
