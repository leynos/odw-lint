# odw-lint roadmap

This roadmap sequences the work described in
[terms-of-reference.md](terms-of-reference.md) and
[technical-design.md](technical-design.md). It follows the GIST alignment:
phases state ideas, steps pursue workstreams that validate or falsify those
ideas, and tasks are review-sized execution units.

The roadmap makes no date or duration commitments. It assumes implementation
will proceed in the existing Bun and TypeScript repository, with any major
scope changes captured in ADRs before code relies on them.

## 1. Foundational phase: static workflow contract

Idea: if `odw-lint` settles its static workflow model, diagnostic contract, and
fixture corpus before adding broad rules, later slices can focus on useful
workflow feedback rather than reworking parser and reporter boundaries.

This phase proves that an ODW workflow can be analysed without executing
source and that diagnostics can point back to the original file.

### 1.1. Ratify the packaging and command boundary

This step answers whether v1 is a standalone CLI only, an ODW subcommand, or a
library designed for both. The answer informs command naming, package exports,
and integration tests. See [technical-design.md](technical-design.md) §§6 and
12.

- [ ] 1.1.1. Write an ADR choosing the v1 packaging boundary.
  - See [technical-design.md](technical-design.md) §12.
  - Success: the ADR states whether `odw-lint check`, `odw check`, or both are
    in scope for v1.
- [ ] 1.1.2. Define the public command contract in repository docs.
  - Requires 1.1.1.
  - See [technical-design.md](technical-design.md) §6.
  - Success: command arguments, flags, and exit codes match the design.

### 1.2. Build the diagnostic and source-position spine

This step answers whether all rules can report through one stable diagnostic
shape. The result informs every parser, rule, and reporter task. See
[technical-design.md](technical-design.md) §§7 and 10.4.

- [ ] 1.2.1. Implement the diagnostic type, severity model, rule identifier
  type, and JSON reporter.
  - See [technical-design.md](technical-design.md) §7.
  - Success: text and JSON reporters are generated from the same diagnostic
    objects.
- [ ] 1.2.2. Implement line-index and source-span helpers for original files.
  - See [technical-design.md](technical-design.md) §§5.1 and 10.4.
  - Success: offsets, lines, columns, and snippets round-trip for fixtures
    with LF and trailing-newline variants.

### 1.3. Establish the workflow fixture corpus

This step answers whether the linter has enough representative source to
detect regressions. The fixture corpus informs loader parity, rule behaviour,
and future ODW integration. See [technical-design.md](technical-design.md)
§10.1.

- [ ] 1.3.1. Import ODW example workflows as read-only fixture snapshots.
  - See [technical-design.md](technical-design.md) §10.1.
  - Success: every fixture records expected "no error" status before any rule
    broadening.
- [ ] 1.3.2. Add invalid fixture families for missing metadata, malformed
  metadata, unsupported imports or exports, and syntax errors.
  - See [technical-design.md](technical-design.md) §§8.1 and 10.1.
  - Success: each invalid fixture has expected rule identifiers and source
    spans.
- [ ] 1.3.3. Add masking fixtures with decoy workflow syntax inside comments,
  strings, regex literals, and template literals.
  - See [technical-design.md](technical-design.md) §§5.2 and 10.1.
  - Success: decoy syntax does not produce envelope diagnostics.

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
[technical-design.md](technical-design.md) §§5.2, 5.3, and 8.1.

- [ ] 2.1.1. Implement a source masker for comments, strings, template
  literals, and regex literals.
  - Requires steps 1.2-1.3.
  - See [technical-design.md](technical-design.md) §5.2.
  - Success: masking fixtures from 1.3.3 do not affect meta extraction.
- [ ] 2.1.2. Implement static `export const meta` extraction and unsupported
  import/export detection.
  - Requires 2.1.1.
  - See [technical-design.md](technical-design.md) §§5.2 and 8.1.
  - Success: valid ODW examples pass envelope scanning and invalid import or
    export fixtures fail with exact spans.
- [ ] 2.1.3. Implement static metadata checks for required `name` and
  `description`.
  - Requires 2.1.2.
  - See [technical-design.md](technical-design.md) §§5.3 and 8.1.
  - Success: no workflow source is evaluated while metadata fixtures receive
    deterministic diagnostics.

### 2.2. Normalize and parse workflow bodies with SWC

This step answers whether ODW's top-level body can be represented as parseable
source without losing span fidelity. It informs all later AST rules. See
[technical-design.md](technical-design.md) §§5.1 and 10.4.

- [ ] 2.2.1. Add `@swc/core` and implement the parser adapter.
  - Requires 2.1.2.
  - See [technical-design.md](technical-design.md) §§4 and 5.1.
  - Success: body syntax errors become `odw/body-syntax` diagnostics rather
    than thrown exceptions.
- [ ] 2.2.2. Implement body normalization for top-level `return` and
  `await`.
  - Requires 2.2.1.
  - See [technical-design.md](technical-design.md) §§4 and 5.1.
  - Success: ODW examples containing top-level `return` and `await` parse with
    original-source span mapping.
- [ ] 2.2.3. Add span snapshot assertions for parser-backed diagnostics.
  - Requires 2.2.2.
  - See [technical-design.md](technical-design.md) §10.4.
  - Success: each body diagnostic includes a stable original-source snippet.

### 2.3. Ship the minimal `check` command

This step answers whether the checker can run as a normal repository gate.
It unlocks CI adoption and user feedback. See
[technical-design.md](technical-design.md) §§6 and 14.

- [ ] 2.3.1. Implement `odw-lint check` for explicit file paths.
  - Requires steps 2.1-2.2.
  - See [technical-design.md](technical-design.md) §6.
  - Success: the command returns the designed exit codes for valid and invalid
    fixtures.
- [ ] 2.3.2. Add text output with file, line, column, severity, rule, and
  message.
  - Requires 1.2.1 and 2.3.1.
  - See [technical-design.md](technical-design.md) §7.
  - Success: human output contains enough location information to fix a
    fixture without opening JSON.
- [ ] 2.3.3. Add JSON output and a JSON contract fixture.
  - Requires 1.2.1 and 2.3.1.
  - See [technical-design.md](technical-design.md) §7.
  - Success: JSON output is stable under snapshot tests.

## 3. Second vertical slice: portability and orchestration feedback

Idea: if `odw-lint` can separate hard ODW errors from Claude portability and
orchestration risks, authors can improve workflows without being blocked by
heuristic findings.

This phase adds the rules that make the tool more than a syntax checker while
keeping default severities conservative.

### 3.1. Add Claude compatibility diagnostics

This step answers whether ODW-only validity and Claude portability can be
reported clearly in one command. The result informs strict-mode policy. See
[technical-design.md](technical-design.md) §8.2.

- [ ] 3.1.1. Implement pure-literal metadata compatibility checks.
  - Requires 2.1.3.
  - See [technical-design.md](technical-design.md) §§5.3 and 8.2.
  - Success: ODW-valid but Claude-incompatible metadata produces
    `odw/claude-pure-meta`.
- [ ] 3.1.2. Implement deterministic-time and randomness warnings for
  `Date.now()`, `Math.random()`, and arg-less `new Date()`.
  - Requires 2.2.2.
  - See [technical-design.md](technical-design.md) §8.2.
  - Success: warnings match ODW's `scanDualCompat` behaviour for trusted
    fixtures.
- [ ] 3.1.3. Implement `--strict-claude` severity promotion.
  - Requires 3.1.1 and 3.1.2.
  - See [technical-design.md](technical-design.md) §§6.2 and 8.2.
  - Success: strict mode exits non-zero for Claude compatibility warnings.

### 3.2. Add first orchestration-risk rules

This step answers whether AST-backed heuristics can produce useful warnings
without blocking dynamic workflows. It informs future rule severity defaults.
See [technical-design.md](technical-design.md) §8.3.

- [ ] 3.2.1. Implement bounded-loop detection around agent dispatch.
  - Requires phase 2.
  - See [technical-design.md](technical-design.md) §8.3.
  - Success: the bounded ODW `loop-until-dry` example passes while an
    unbounded dispatch loop fixture warns.
- [ ] 3.2.2. Implement bounded-fan-out detection for `parallel` calls.
  - Requires phase 2.
  - See [technical-design.md](technical-design.md) §8.3.
  - Success: literal and args-bounded fan-out passes while unknown fan-out
    warns.
- [ ] 3.2.3. Implement completion-order control-flow warnings for
  `Promise.race`.
  - Requires phase 2.
  - See [technical-design.md](technical-design.md) §8.3.
  - Success: warnings include an explanation of resumability risk.

### 3.3. Add configuration and warning policy

This step answers whether teams can adopt the rules without forking defaults.
It informs CI usage and later plugin integration. See
[technical-design.md](technical-design.md) §§6.2 and 9.

- [ ] 3.3.1. Implement optional configuration loading with include, exclude,
  strictness, and rule severity settings.
  - Requires 2.3.1.
  - See [technical-design.md](technical-design.md) §9.
  - Success: unknown rule identifiers fail configuration validation.
- [ ] 3.3.2. Implement `--max-warnings`.
  - Requires 3.3.1.
  - See [technical-design.md](technical-design.md) §6.2.
  - Success: the command exits code 1 when warning count exceeds the threshold.
- [ ] 3.3.3. Add pairwise CLI-mode coverage for format, strict mode, warning
  threshold, config, and stdin.
  - Requires 3.3.1 and 3.3.2.
  - See [technical-design.md](technical-design.md) §10.3.
  - Success: the highest-risk flag combinations are covered without an
    exhaustive test explosion.

## 4. Third vertical slice: adoption and ODW integration

Idea: if the standalone checker fits ODW's examples, CI, and future command
surface, it can become the shared static-analysis layer for multi-provider
workflow authoring instead of a side tool.

This phase turns the linter into a documented adoption path and prepares an
ODW integration point without forcing the integration before the core is
stable.

### 4.1. Harden against ODW runtime drift

This step answers whether `odw-lint` can track ODW loader semantics over time.
It informs release confidence and ownership boundaries. See
[technical-design.md](technical-design.md) §§10.1 and 10.2.

- [ ] 4.1.1. Add loader-parity tests against trusted ODW fixture snapshots.
  - Requires phase 3.
  - See [technical-design.md](technical-design.md) §10.2.
  - Success: ODW-valid fixtures and known invalid fixtures agree with the
    designed static expectations.
- [ ] 4.1.2. Add a fixture-update workflow for new ODW examples.
  - Requires 4.1.1.
  - See [technical-design.md](technical-design.md) §10.1.
  - Success: adding an ODW example requires updating expected diagnostics in
    one reviewable change.

### 4.2. Document CI and authoring workflows

This step answers whether a workflow author can install and operate the tool
without knowing its internals. It informs the v1 release checklist. See
[technical-design.md](technical-design.md) §§6, 7, and 14.

- [ ] 4.2.1. Write user documentation for `odw-lint check`, JSON output, and
  strict Claude mode.
  - Requires phase 3.
  - See [technical-design.md](technical-design.md) §§6-8.
  - Success: the guide includes copy-pasteable local and CI commands.
- [ ] 4.2.2. Add a repository CI example that fails on errors and optionally
  on warnings.
  - Requires 4.2.1.
  - See [technical-design.md](technical-design.md) §§6.3 and 14.
  - Success: CI output includes text diagnostics while JSON remains available
    for tools.

### 4.3. Prepare the ODW command integration

This step answers whether ODW can call the checker as a library rather than
shelling out. It informs whether `odw check` belongs in ODW v1 integration.
See [technical-design.md](technical-design.md) §§6.1 and 12.

- [ ] 4.3.1. Export a programmatic `checkWorkflows` API from `odw-lint`.
  - Requires phase 3.
  - See [technical-design.md](technical-design.md) §§5 and 12.
  - Success: the CLI uses the same API as external callers.
- [ ] 4.3.2. Prototype an ODW-side `odw check` command against the exported
  API.
  - Requires 4.3.1.
  - See [technical-design.md](technical-design.md) §6.1.
  - Success: the prototype produces equivalent diagnostics to
    `odw-lint check`.

## 5. Deferred extensions

Idea: if the core v1 promise is already trustworthy and boring to operate,
the project can evaluate broader extensions on their product value instead of
letting them destabilize the main release.

The following work is intentionally outside the core v1 path.

### 5.1. Evaluate Biome and GritQL integration

This step answers whether Biome can host a subset of ODW lint rules for teams
already using Biome. See [technical-design.md](technical-design.md) §§3 and
13.

- [ ] 5.1.1. Prototype Biome GritQL snippets for simple AST-pattern
  diagnostics.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §13.
  - Success: the prototype documents which rules cannot be expressed because
    they need ODW envelope semantics.

### 5.2. Evaluate Oxlint plugin integration

This step answers whether Oxlint can host AST-backed ODW rules once its JS
plugin API is suitable for the project. See
[technical-design.md](technical-design.md) §§3 and 13.

- [ ] 5.2.1. Prototype an Oxlint JS plugin for one orchestration-risk rule.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §13.
  - Success: the prototype records API gaps around custom parsing, rule
    configuration, and source-span parity.

### 5.3. Evaluate editor and Rust-core paths

This step answers whether adoption now requires editor diagnostics or a
Node-free analyser. See [technical-design.md](technical-design.md) §§12 and
13.

- [ ] 5.3.1. Write an ADR for language-server support.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §13.
  - Success: the ADR chooses between reusing the TypeScript core and building
    an editor-specific service.
- [ ] 5.3.2. Write an ADR for a Rust analyser core only if performance,
  distribution, or language-server constraints justify it.
  - Requires phase 4.
  - See [technical-design.md](technical-design.md) §§12 and 13.
  - Success: the ADR includes measurements or distribution constraints rather
    than a preference for Rust as an implementation language.
