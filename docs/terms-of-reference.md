# odw-lint terms of reference

Status: Draft v0.1
Audience: ODW maintainers, workflow authors, and implementation reviewers
Companion documents: [technical design](technical-design.md) and
[roadmap](roadmap.md)

## 1. Purpose

`odw-lint` exists to give Open Dynamic Workflows (ODW) authors a static
preflight check before a workflow spends agent budget or fails inside a run.
ODW workflows use a JavaScript-like workflow dialect with `export const meta`,
top-level `await`, top-level `return`, and injected globals such as `agent`,
`parallel`, `pipeline`, `phase`, `log`, `budget`, `workflow`, and `args`.

The current default for a host-authored workflow is to run it. Generated
workflows can call ODW's injected `validate(source)` primitive, but an author
editing a file in a repository has no dedicated lint or validation command.
That gap makes syntax, dialect, portability, and orchestration mistakes show
up late, often after an agent run has started.

The terms of reference defines the problem space. The companion technical
design chooses the implementation shape.

## 2. Domain

The domain is static analysis for dynamic agent-workflow scripts. It sits at
the boundary between JavaScript tooling, ODW runtime semantics, Claude Code
workflow compatibility, and CI quality gates.

ODW workflows are not ordinary ECMAScript modules. The body must be parsed
with awareness of the workflow dialect, injected names, and portability rules.
A generic JavaScript linter can catch ordinary syntax and style issues, but it
cannot know whether a workflow has exactly one supported `meta` export, whether
its body imports primitives incorrectly, or whether its orchestration shape is
risky for resumable agent execution.

## 3. Market context

The neighbouring tool classes are:

|Tool class|Current role|Gap for ODW|
|---|---|---|
|Generic JavaScript linters|Style, correctness, and common bug rules|They do not model ODW's workflow dialect or injected primitive contract.|
|Parser libraries|Parse JavaScript and TypeScript source|They do not decide which dialect features are legal for ODW.|
|ODW runtime validation|Compile-check generated workflow source from inside a workflow|It is not a host-side command for repository authors or CI.|
|Claude Code workflow compatibility checks|Keep workflows portable to Claude Code's Workflow tool|They need to be surfaced before users run ODW.|
|Agent supervision tools|Inspect runs after dispatch|They do not prevent avoidable dispatch-time failures.|

The product gap is trust, not parser availability. Workflow authors need a
workflow-aware check that reports actionable diagnostics with source spans and
exit codes that CI can enforce.

## 4. Users and stakeholders

|Actor|Role|Need|
|---|---|---|
|ODW workflow author|Writes and reviews workflow scripts|Catch dialect and portability problems before execution.|
|ODW maintainer|Evolves the runtime and workflow examples|Keep static diagnostics aligned with runtime semantics.|
|Agent operator|Runs workflows against paid or local coding agents|Avoid spending runs on workflows that could have failed statically.|
|CI maintainer|Wires repository quality gates|Get deterministic text and JSON output with stable exit codes.|
|Tooling contributor|Adds editor, formatter, or ecosystem integrations|Build on a documented diagnostic and rule model.|

General JavaScript application developers are not a target user. They should
continue to use Biome, Oxlint, ESLint, or project-native tooling for ordinary
application code.

## 5. Job to be done

When an author is creating, reviewing, or generating an ODW workflow, they
want to check the file without running agents, so they can fix workflow
dialect, portability, and orchestration mistakes while the change is still
cheap.

The job starts before `odw run`, before a pull request lands, and before a
workflow is published as a reusable artefact. It ends when the author has a
clear pass/fail result and diagnostics that identify the original source
location.

## 6. Goals

- Detect ODW dialect errors before execution.
- Report missing or malformed workflow metadata.
- Distinguish ODW-only validity from Claude Code portability warnings.
- Warn about workflow patterns that are legal but risky, such as unbounded
  fan-out or non-deterministic resumability hazards.
- Expose an output contract usable by humans, CI, and future editor tooling.
- Match the `ruff check` command's user experience wherever the semantics
  transfer cleanly to workflow linting.
- Align diagnostics with ODW examples and runtime behaviour.

## 7. Non-goals

- `odw-lint` will not replace Biome, Oxlint, ESLint, TypeScript, or a project
  formatter for general JavaScript quality.
- `odw-lint` will not execute workflow bodies or call agents.
- `odw-lint` will not prove prompt quality or agent-answer correctness.
- `odw-lint` will not require workflows to be Claude Code portable unless the
  caller opts into a strict compatibility mode.
- `odw-lint` will not ship an editor extension as part of the first release.
- `odw-lint` will not make ODW's runtime reject workflows that the linter only
  warns about.

## 8. Success criteria

The product is useful when a maintainer can run a command against ODW example
workflows and receive deterministic diagnostics without starting an agent. A
reasonable v1 success bar is:

- A valid ODW workflow exits with code 0 and no false error.
- A workflow with no `export const meta` receives an error before execution.
- A workflow with unsupported top-level `import` or extra `export` receives an
  error tied to the original source span.
- A workflow using `Date.now()`, `Math.random()`, or arg-less `new Date()`
  receives a Claude compatibility warning.
- JSON output contains stable fields for file, rule, severity, message, span,
  schema version, summary counts, and optional suggestions.
- CLI exit codes, fix flags, output-format flags, config overrides, stdin
  handling, and ignore handling follow `ruff check` semantics unless an
  ODW-specific reason requires a documented deviation.
- CI can fail on errors and optionally fail on warning thresholds.
- The rule corpus includes representative ODW examples and deliberately
  invalid fixtures.
- Hostile metadata cannot execute during lint.

## 9. Constraints

- ODW's current implementation and examples are TypeScript and JavaScript, so
  the first implementation should fit a Node/Bun toolchain.
- The linter must not execute untrusted workflow source.
- Runtime parity matters: diagnostics that disagree with ODW's loader must be
  intentional and documented.
- The static-analysis boundary must be explicit before implementation starts.
- `odw-lint` owns its SWC-based static parser; it does not depend on ODW
  maintainers changing ODW's public exports or on vendoring ODW helper source
  before v1 can proceed.
- Compatibility diagnostics must preserve the distinction between "ODW can run
  this" and "Claude Code can also accept this".
- The first release should favour clear diagnostics over broad lint coverage.
- Ruff's `check` command is the UX precedent for the `odw-lint check` command.
- The repository already has Bun, TypeScript, Biome, markdownlint, and Makefile
  gates.

## 10. Assumptions

- Workflow files are small enough that a single-process AST walk is adequate
  for v1.
- Authors will accept a dedicated ODW checker alongside their normal
  JavaScript linter.
- ODW's workflow semantics are stable enough to mirror with an `odw-lint`-owned
  static parser and parity tests.
- The most urgent adoption path is CLI and CI, not an editor extension.
- Some findings will remain heuristic warnings rather than hard errors.

## 11. Open questions

- Should `odw-lint` remain a standalone package, become an `odw check`
  subcommand, or support both entry points?
- Which diagnostics are fatal by default, and which move behind
  `--strict-claude` or `--strict`?
- Should configuration live in `odw-lint.config.*`, `odw.config.json`, or both?
- How much fix support belongs in v1, given that source-preserving edits in a
  workflow dialect need careful span handling?
- Which optional integrations should be first after the core CLI: Biome
  GritQL snippets, an Oxlint plugin, or editor diagnostics?

## 12. Handoff

The technical design should decide the parser, diagnostic model, rule engine,
configuration surface, and verification strategy. The roadmap should sequence
that work around vertical slices: first a trustworthy static dialect check,
then user-facing lint value, then optional ecosystem integrations.
