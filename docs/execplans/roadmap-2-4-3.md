# Add JSON output and a JSON contract fixture (roadmap 2.4.3)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

After this change a developer or CI job can render the diagnostics from
`odw-lint check` as a stable, versioned JSON document instead of the
one-line-per-diagnostic text output:

```text
bun run src/cli/main.ts check --output-format json \
  tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js
```

The command prints the versioned diagnostic envelope described in
`docs/technical-design.md` §8 to standard output:

```json
{
  "schemaVersion": 1,
  "tool": { "name": "odw-lint", "version": "0.1.0" },
  "summary": { "files": 1, "errors": 1, "warnings": 0, "infos": 0, "hints": 0 },
  "diagnostics": [
    {
      "file": "workflows/example.js",
      "rule": "odw/meta-required",
      "severity": "error",
      "message": "Workflow source must export literal metadata.",
      "span": {
        "start": { "offset": 0, "line": 1, "column": 1 },
        "end": { "offset": 0, "line": 1, "column": 1 }
      },
      "docs": "docs/rules/meta-required.md",
      "suggestions": []
    }
  ]
}
```

Success is observable three ways. First, a pure serializer
`formatJsonReport(report)` turns any `DiagnosticReport` into that exact envelope
shape and is pinned by a Bun snapshot. Second, a committed golden **JSON
contract fixture** captures the serialized envelope for a real reviewed source
fixture, and a parity test proves the live analyser still produces it. Third,
`odw-lint check --output-format json` emits the envelope over a child process
while keeping the roadmap 2.4.1 exit-code contract (`0` clean, `1` any
diagnostic or unreadable input, `2` invalid invocation) unchanged.

This is the third task of roadmap step 2.4 ("Ship the minimal `check`
command"), and it depends on roadmap 1.2.1 (the source-position/span coordinate
contract), 2.1.10 (the `DIAGNOSTIC_REPORT_SCHEMA` JSON Schema literal), and
2.4.1 (the explicit-path `check` command). It deliberately implements only the
`json` reporter and the minimal `--output-format full|json` selector. Richer
text formatting (roadmap 2.4.2), the remaining Ruff output formats
(`concise`, `json-lines`, `github`, `gitlab`, `junit`, `sarif`), `--output-file`,
glob/config discovery, `--stdin-filename`, and the severity-gating flags
(roadmap 2.4.4, 3.1.3) are explicitly out of scope and are called out below so
this slice does not pre-empt them.

## Constraints

Hard invariants that must hold throughout implementation.

- Work happens only in the git-donkey worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-3` on branch
  `roadmap-2-4-3`. Never read-modify-write any file in the root/control
  checkout. All edit-tool paths are absolute under that worktree.
- Production code must not execute workflow source, evaluate metadata, import
  ODW runtime helpers, or start runs. The JSON reporter only re-shapes the
  already-inert `DiagnosticReport` produced by the vetted `lintWorkflowSource`
  pipeline (`docs/technical-design.md` §§5, 6.4; `docs/developers-guide.md`
  §"Static-Analysis Boundary"; `docs/adr/0001-static-analysis-boundary.md`;
  `docs/repository-layout.md` §"Source boundaries").
- Do not change `schemaVersion`, add or rename a catalogued rule ID, alter an
  existing rule's meaning, or change the diagnostic object shape. This task
  serializes the existing contract; any of those changes would trigger the
  schema-version review path in `docs/technical-design.md` §8 and is out of
  scope. The JSON must validate against the existing `DIAGNOSTIC_REPORT_SCHEMA`
  (`src/diagnostics/schema.ts`, from roadmap 2.1.10).
- The JSON envelope key order and field names must match `docs/technical-design.md`
  §8 exactly: top level `schemaVersion`, `tool` (`name`, `version`), `summary`
  (`files`, `errors`, `warnings`, `infos`, `hints`), `diagnostics`; each
  diagnostic `file`, `rule`, `severity`, `message`, `span` (`start`/`end` each
  `offset`, `line`, `column`), optional `docs`, then `suggestions`. `span`
  always refers to original source; `offset` is a zero-based UTF-8 byte offset;
  `line`/`column` are one-based, `column` counted in Unicode code points
  (`docs/technical-design.md` §8; the coordinate contract from roadmap 1.2.1).
- No new `bin` field is added to `package.json`; the entrypoint stays
  `bun run src/cli/main.ts` (`docs/developers-guide.md` §"CLI" line 59). The
  full Ruff flag surface is roadmap 2.4.4, so `--output-format` is the only new
  flag; it accepts only the implemented values `full` and `json`.
- Read failures keep the roadmap 2.4.1 behaviour: they are written to stderr as
  `error: cannot read <path>: <message>` and drive exit `1`; they are not
  folded into the JSON envelope, because there is no catalogued IO-error rule
  yet and inventing one is out of scope (`docs/developers-guide.md` lines 34-49;
  roadmap 2.4.1 Decision Log). `summary.files` counts readable files only, as
  `runCheck` already does.
- No production or test source file exceeds 400 lines (`AGENTS.md` §"Code Style
  and Structure"). Keep the reporter and the CLI arg parser as small,
  single-responsibility modules.
- The reviewed fixture corpus is single-sourced (roadmap 2.3.5). Corpus-driven
  tests consume the owner modules under
  `tests/static-analysis/fixtures/` (for example
  `fixtures/invalid-workflows/corpus.ts` and `fixtures/corpus-support.ts`);
  never inline corpus-location literals.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md` §"Documentation Maintenance"; `en-gb-oxendict`
  skill).

## Tolerances (exception triggers)

- Scope: if delivering the JSON reporter, the contract fixture, and the flag
  requires touching more than ~12 files or adding more than ~400 net lines of
  production code, stop and escalate.
- Interface: if the work appears to require a new catalogued rule ID, a
  `schemaVersion` bump, a diagnostic-object shape change, a new `bin` field, or
  a second new CLI flag beyond `--output-format`, stop and escalate — those
  belong to later 2.4.x/3.x tasks.
- Dependencies: if any work item seems to need a new runtime or dev dependency
  (for example a JSON-schema validator such as Ajv, or an argument-parsing or
  BDD library), stop and escalate. Serialization uses `JSON.stringify` over an
  explicit projection; schema conformance is asserted structurally against the
  existing literal schema.
- Discovery/format creep: if a work item starts implementing `--output-file`,
  `json-lines`, `github`/`gitlab`/`junit`/`sarif`, glob expansion, configured
  include roots, or `--stdin-filename`, stop — those are 2.4.4 and later.
- Ambiguity: if the emitted envelope cannot simultaneously satisfy the §8
  documented example (which shows `"suggestions": []`) and the
  `exactOptionalPropertyTypes` in-memory report (which omits undefined
  `suggestions`), follow the Decision Log ruling below; if reviewers dispute it,
  stop and present the divergence.
- Iterations: if `make all` still fails after 3 focused attempts on one work
  item, stop and escalate with the failing gate output.

## Risks

- Risk: relying on JavaScript object insertion order for a public contract.
  `JSON.stringify` preserves insertion order, and every diagnostic today is
  built by `createRuleDiagnostic` (`src/diagnostics/rule-diagnostic.ts`) in the
  §8 key order, but a future upstream change could reorder keys and silently
  drift the JSON.
  Severity: medium. Likelihood: low.
  Mitigation: the serializer performs an **explicit canonical projection**
  (build a fresh object literal in §8 order) rather than stringifying the report
  as-is, so the emitted order is independent of upstream construction order. A
  snapshot pins the exact text.
- Risk: the `suggestions`/`docs` optional-field presence fork. The in-memory
  `DiagnosticReport` omits `suggestions` when undefined (because
  `tsconfig.json` sets `exactOptionalPropertyTypes: true`), but
  `docs/technical-design.md` §8 and `docs/users-guide.md` both show
  `"suggestions": []` present.
  Severity: medium. Likelihood: high.
  Mitigation: pinned in the Decision Log — the projection always emits
  `suggestions` as an array (empty when the diagnostic has none) and emits
  `docs` when the diagnostic carries a documentation path. Bind it with tests so
  the choice cannot silently regress.
- Risk: absolute fixture paths making JSON non-deterministic. The e2e process
  test invokes the CLI with absolute fixture paths, so the `file` field is
  machine-specific and cannot be snapshotted byte-for-byte.
  Severity: medium. Likelihood: high.
  Mitigation: the golden contract fixture (WI-2) is produced in-process with a
  fixed logical file path and compared structurally; the e2e test (WI-3)
  asserts structural fields (`schemaVersion`, `tool.name`, `summary`, first
  diagnostic `rule`) and exit-code parity, not a whole-document snapshot.
- Risk: Biome reformatting the committed golden `.json`. `biome.jsonc` includes
  `tests/**/*` with `ignoreUnknown: true`, so `make check-fmt` formats JSON
  fixtures under `tests/` (2-space, trailing newline) and could drift them from
  the serializer's exact bytes (no trailing newline).
  Severity: low. Likelihood: high.
  Mitigation: the parity test compares the golden **structurally**
  (`JSON.parse(golden)` deep-equals `JSON.parse(formatJsonReport(report))`); a
  separate Bun snapshot pins the serializer's exact string. The golden `.json`
  stays Biome-owned like the masking fixtures, and trailing-newline formatting
  does not break the structural assertion.
- Risk: `--output-format` parsing regressing the 2.4.1 usage contract. The
  current parser rejects every argument starting with `-` as an unknown option.
  Severity: low. Likelihood: medium.
  Mitigation: extend parsing narrowly to recognize `--output-format <value>` and
  `--output-format=<value>` only; keep every other `-`-prefixed argument a
  usage error (exit `2`); keep the existing usage-error table tests green and
  add rows for the new flag.

## Progress

- [x] (2026-07-06) WI-1: Add the canonical `formatJsonReport` diagnostic
      serializer and export it.
- [x] (2026-07-06) WI-2: Add the reviewed JSON contract fixture and its
      analyser-parity test.
- [x] (2026-07-06) WI-3: Add `--output-format full|json` to the explicit-path
      check CLI.
- [x] (2026-07-06) WI-4: Document implemented JSON output across the
      guides.

## Surprises & discoveries

- Observation: every catalogued diagnostic is constructed by
  `createRuleDiagnostic` in exactly the `docs/technical-design.md` §8 key order,
  and it always sets `docs`.
  Evidence: `src/diagnostics/rule-diagnostic.ts:35-49`.
  Impact: the canonical projection matches real diagnostics without reordering;
  `docs` will be present for all current rules, so the golden fixture shows it.
- Observation: the in-memory `DiagnosticReport` omits `suggestions` when a
  diagnostic has none, but the documented JSON shows `"suggestions": []`.
  Evidence: `src/diagnostics/report.ts:74-89` and `tsconfig.json`
  `exactOptionalPropertyTypes`; `docs/technical-design.md:344`,
  `docs/users-guide.md:83`.
  Impact: drives the Decision Log ruling to always emit `suggestions` in JSON.
- Observation: adding `src/diagnostics/report-json.ts` must update both the
  package-entry module list and the diagnostics module inventory.
  Evidence: `tests/diagnostics/package-entry.test.ts` and
  `tests/diagnostics/architecture.test.ts` failed until
  `tests/diagnostics/architecture-fixtures.ts` listed the new reporter module in
  both places.
  Impact: future diagnostic reporter modules must keep the architecture fixture
  inventories synchronized with source layout and package-entry shape.
- Observation: `docs/contents.md` indexes every top-level ExecPlan, including
  this approved plan.
  Evidence: `tests/build-gate/documentation-contents.test.ts` reported
  `execplans/roadmap-2-4-3.md` as missing until `docs/contents.md` linked it.
  Impact: this WI-1 commit includes the required contents-index link as a gate
  freshness fix; it does not document user-facing JSON CLI behaviour, which
  remains WI-4.
- Observation: `tests/diagnostics/fixtures.ts` already exists as a source file,
  so the planned `tests/diagnostics/fixtures/json-contract.json` path cannot be
  created without renaming a shared diagnostics fixture module.
  Evidence: `find tests/diagnostics/fixtures -maxdepth 2 -type f -print`
  failed because `tests/diagnostics/fixtures` is not a directory, while
  `tests/diagnostics/fixtures.ts` is imported by the existing diagnostics test
  suites.
  Impact: WI-2 keeps the golden artefact under `tests/diagnostics/` as
  `json-contract.fixture.json`, beside the parity test and snapshot, rather
  than performing an out-of-scope fixture-module rename.
- Observation: adding `--output-format` directly to `parseCheckArgs` exceeded
  the Oxlint complexity threshold.
  Evidence: the first scrutineer gate pass reported
  `src/cli/check-cli.ts:48:24` with complexity 12, above the configured maximum
  of 8.
  Impact: WI-3 split flag/value parsing into small helpers while keeping the
  public CLI surface unchanged.
- Observation: in this environment, `bunx mdtablefix <files>` prints the
  corrected Markdown but does not rewrite files unless `--in-place` is passed.
  Evidence: the first WI-4 targeted formatting pass left the users-guide exit
  code table unaligned, and `bunx markdownlint-cli2 --fix` reported
  `docs/users-guide.md:73` as MD060 until `bunx mdtablefix --in-place
  docs/developers-guide.md docs/users-guide.md` was run.
  Impact: WI-4 used the same two-file formatter scope required by the plan, but
  added the explicit `--in-place` flag to make `mdtablefix` mutate those files.

## Decision log

- Decision: the JSON serializer performs an explicit canonical projection into a
  fresh object literal in `docs/technical-design.md` §8 key order, rather than
  `JSON.stringify(report)` directly.
  Rationale: makes the emitted key order a property of the reporter, not of
  upstream diagnostic construction, so the public contract cannot drift silently.
  Date/Author: 2026-07-06, planning agent.
- Decision: the JSON projection always emits `suggestions` as an array (empty
  when absent) and emits `docs` only when the diagnostic carries a documentation
  path.
  Rationale: both `docs/technical-design.md` §8 and `docs/users-guide.md` show
  `"suggestions": []` present, so consumers should never have to handle a
  missing `suggestions` key; `docs` is optional in `DIAGNOSTIC_REPORT_SCHEMA`
  (`src/diagnostics/schema.ts`) and is emitted when present (always, for current
  catalogued rules). The alternative — a byte-faithful serialization that omits
  undefined optionals — was rejected because it contradicts the two documented
  examples. Both variants satisfy the schema, so this is the tie-breaker.
  Date/Author: 2026-07-06, planning agent.
- Decision: read failures stay stderr-only CLI lines in JSON mode; they are not
  represented as diagnostics inside the envelope.
  Rationale: there is no catalogued IO-error rule yet, and inventing one is out
  of scope (roadmap 2.4.4). Preserves the roadmap 2.4.1 exit-code contract and
  keeps `summary.files` = readable-files count.
  Date/Author: 2026-07-06, planning agent.
- Decision: WI-4 does not edit `docs/repository-layout.md`, and that file is
  therefore excluded from WI-4's `mdtablefix`/`markdownlint-cli2 --fix`
  invocation.
  Rationale: the `src/diagnostics/` responsibility note
  (`docs/repository-layout.md:26` — "text rendering, JSON Schema support and
  report shapes") and the "Source boundaries" prose (`:76` — `src/diagnostics/`
  "owns diagnostic data and presentation contracts") already cover the JSON
  reporter generically and do not enumerate reporter files (for example
  `text.ts`) by name, so adding `report-json.ts` there is redundant. Formatting
  an unedited file would rewrite it with unrelated churn that must be
  parked/discarded, violating the standing rule that direct formatter file lists
  name only files the work item actually edits. The alternative — making the
  `repository-layout.md` edit mandatory so it could stay in the formatter list —
  was rejected because the existing prose is already correct and the edit adds no
  information.
  Date/Author: 2026-07-06, planning agent.
- Decision: expose `formatJsonReport` from the package entry (`src/index.ts`)
  for parity with the already-public `formatTextDiagnostics`.
  Rationale: JSON rendering is a diagnostic-contract surface, and
  `docs/technical-design.md` §8 states "text output is derived from the same
  diagnostic objects as JSON output"; both reporters should be reachable through
  the package entry. Requires updating the reviewed export fixtures and the
  public-consumer snapshot, which is a bounded, in-scope change.
  Date/Author: 2026-07-06, planning agent.
- Decision: keep WI-1 limited to the pure serializer and public export, while
  also updating the architecture fixtures and `docs/contents.md` entries that
  are necessary for the repository gates to pass.
  Rationale: those fixture/index updates are direct consequences of adding the
  reporter module and ExecPlan file; they do not start the WI-2 golden fixture,
  WI-3 CLI flag, or WI-4 user-guide work.
  Date/Author: 2026-07-06, implementation agent.
- Decision: store the WI-2 golden contract as
  `tests/diagnostics/json-contract.fixture.json` instead of the originally
  planned `tests/diagnostics/fixtures/json-contract.json`.
  Rationale: `tests/diagnostics/fixtures.ts` is already a file and a reviewed
  helper module for existing diagnostics tests, so creating a sibling
  `fixtures/` directory would require an unrelated rename. The chosen path
  keeps the golden close to its parity test while preserving the single-source
  static-analysis corpus imports.
  Date/Author: 2026-07-06, implementation agent.
- Decision: keep the new `--output-format` parser in `src/cli/check-cli.ts`
  rather than introducing a new CLI argument module for WI-3.
  Rationale: after extracting operand and format-value parsing helpers, the CLI
  module stays below the 400-line ceiling and below the configured complexity
  threshold. A new module would add indirection without creating a shared
  boundary yet.
  Date/Author: 2026-07-06, implementation agent.

## Outcomes & retrospective

To be completed at milestones and at completion. Compare the delivered JSON
envelope against `docs/technical-design.md` §8 and note any deviations, the
final file/line budget against the tolerances, and lessons for the remaining
2.4.x reporter work.

WI-1 delivered the canonical `formatJsonReport(report)` serializer in
`src/diagnostics/report-json.ts`, exported it from `src/index.ts`, and pinned
the projection with structural tests and Bun snapshots. The emitted envelope
matches `docs/technical-design.md` §8, with the planned `suggestions: []`
default and optional `docs` emission. No CLI JSON output or JSON contract
fixture was added; those remain WI-2 and WI-3. The implementation stayed inside
the file-size and scope tolerances.

WI-2 added the reviewed JSON contract fixture for
`missing-metadata/missing-meta.js`, bound through `runCheck` with the fixed
logical path `workflows/example.js`, and proved analyser parity by comparing the
golden fixture with the live `formatJsonReport` output. The committed fixture
is structural rather than byte-sensitive, and a Bun snapshot pins the live
serializer bytes for the reviewed input. The only deviation from the plan is
the golden path: it is `tests/diagnostics/json-contract.fixture.json` because
`tests/diagnostics/fixtures.ts` already occupies the planned directory name.

WI-3 added the `--output-format full|json` selector to the explicit-path
`check` CLI, preserving `full` as the default text output and routing `json` to
the canonical `formatJsonReport` renderer. Read failures remain stderr-only in
both formats and keep the existing exit-code contract. Unit coverage now checks
JSON output for clean and invalid fixtures, explicit `full`, unsupported
formats, and JSON-mode read failures; the process-level corpus test parses the
real Bun entrypoint's JSON output structurally. The implementation deviation is
internal only: operand parsing was extracted into helpers after Oxlint flagged
the inline parser's complexity.

WI-4 updated the developers' guide and user's guide to document the implemented
JSON output path. The developers' guide now identifies `--output-format json`,
the `src/diagnostics/report-json.ts` module, and the public
`formatJsonReport` export while keeping richer formats, `--output-file`,
discovery, and broader Ruff-compatible flags deferred. The user's guide now
shows the Bun entrypoint, documents `full` as the default output and `json` as
available, keeps JSON Lines/GitHub/GitLab/JUnit/SARIF planned, and aligns the
minimal read-failure exit-code text with the roadmap 2.4.1 contract. The
documented JSON example already matched the emitted envelope, so it did not need
shape changes. `docs/repository-layout.md` remained untouched as planned.

## Context and orientation

`odw-lint` is a private Bun/TypeScript package that statically lints Open
Dynamic Workflow (ODW) `*.js` files without executing them. Relevant modules:

- `src/diagnostics/types.ts` defines `Diagnostic`, `DiagnosticReport`,
  `DiagnosticSummary`, `SourceSpan`, `SourcePosition`, and the constants
  `DIAGNOSTIC_SCHEMA_VERSION` (`1`) and `TOOL_NAME` (`"odw-lint"`).
- `src/diagnostics/report.ts` builds the versioned `DiagnosticReport` envelope
  via `createDiagnosticReport({ version, files, diagnostics })` and counts the
  summary. This is the object the JSON reporter serializes.
- `src/diagnostics/schema.ts` exports `DIAGNOSTIC_REPORT_SCHEMA` (roadmap
  2.1.10), the literal JSON Schema the emitted JSON must satisfy.
- `src/diagnostics/text.ts` exports `formatTextDiagnostics(diagnostics)`, the
  existing one-line-per-diagnostic renderer used by the CLI. The JSON reporter
  is its sibling.
- `src/diagnostics/rule-diagnostic.ts` (`createRuleDiagnostic`) constructs every
  diagnostic in §8 key order and always sets `docs`.
- `src/cli/run-check.ts` exposes `runCheck({ paths, version, readFileText? })`
  returning `{ report: DiagnosticReport, readFailures }`, plus
  `checkDiagnosticsExitCode(outcome)`.
- `src/cli/check-cli.ts` (`runCheckCli(args, io)`) parses arguments, wires
  writers, renders text diagnostics, prints read failures, and returns the exit
  code. `src/cli/main.ts` is the thin Bun entrypoint.
- `src/index.ts` is the private package entry; its named re-exports are pinned
  by `tests/diagnostics/public-api-fixtures.ts`,
  `tests/diagnostics/package-entry.test.ts`, and
  `tests/diagnostics/public-consumer.test.ts` (snapshot).

Terms of art: a **diagnostic report envelope** is the versioned JSON object of
§8. A **canonical projection** is a fresh object built field-by-field in a fixed
key order so serialization is order-stable. A **JSON contract fixture** is a
committed golden `.json` document capturing the serialized envelope for one
reviewed source input, guarded by a parity test that re-derives it from the live
analyser.

Design sources of truth: `docs/technical-design.md` §§7.3 (the
`--output-format` flag), 7.4 (exit codes), 8 (diagnostic contract);
`docs/developers-guide.md` §"CLI"; `docs/users-guide.md` §"Diagnostic reports";
`docs/repository-layout.md` §§"Source boundaries", "Test and fixture
boundaries"; `docs/adr/0001-static-analysis-boundary.md`; `AGENTS.md`
§§"Testing", "TypeScript Guidance".

## Plan of work

Each work item is an atomic, independently committable, `make all`-green change,
delivered Red-Green-Refactor. Do not proceed to the next work item until the
current one's validation passes.

### WI-1: Add the canonical `formatJsonReport` diagnostic serializer and export it

Implements `docs/technical-design.md` §8 (envelope shape and invariants) and the
Decision Log projection ruling. Sibling to `formatTextDiagnostics`
(`docs/repository-layout.md` §"Source boundaries", which places JSON support in
`src/diagnostics/`).

Read first: `docs/technical-design.md` §8; `src/diagnostics/report.ts`,
`src/diagnostics/types.ts`, `src/diagnostics/text.ts`,
`src/diagnostics/schema.ts`; `AGENTS.md` §§"TypeScript Guidance",
"Testing"; `docs/documentation-style-guide.md` for the `/** @file */` block.
Skills: `python-router` is not relevant; load no router (TypeScript has no
router skill in this repo). Load `execplans` (this plan) and `en-gb-oxendict`;
consult `hypothesis`/`crosshair`/`mutmut` are Python-only and do not apply — use
Bun snapshot + table tests instead.

Work:

1. Add `src/diagnostics/report-json.ts` exporting
   `formatJsonReport(report: DiagnosticReport): string`. Build a canonical
   projection: a fresh object literal with keys `schemaVersion`, `tool`
   (`name`, `version`), `summary` (`files`, `errors`, `warnings`, `infos`,
   `hints`), and `diagnostics`, where each diagnostic is projected to `file`,
   `rule`, `severity`, `message`, `span` (`start`/`end` each `offset`, `line`,
   `column`), then `docs` when defined, then `suggestions` (mapping each to
   `{ message }`, defaulting to `[]`). Serialize with `JSON.stringify(projection,
   null, 2)` and return without a trailing newline (the CLI writer adds one).
   Keep the module under 400 lines with small helpers (`projectSpan`,
   `projectDiagnostic`).
2. Add the re-export to `src/index.ts` in alphabetical position:
   `export { formatJsonReport } from "./diagnostics/report-json";`.
3. Update `tests/diagnostics/public-api-fixtures.ts`
   (`EXPECTED_PUBLIC_PACKAGE_EXPORTS`) to include `"formatJsonReport"` in sorted
   position, and refresh the `tests/diagnostics/public-consumer.test.ts`
   snapshot only after confirming the failure is exactly this intentional
   addition.

Tests (Red first): add `tests/diagnostics/report-json.test.ts`:

- Unit: for a report built from `createDiagnosticReport` over the shared
  `diagnosticForSeverity` fixtures (`tests/diagnostics/fixtures.ts`), assert the
  parsed JSON deep-equals the expected projection, including `suggestions: []`
  present and `docs` present.
- Contract: assert the serialized string parses and that its top-level keys are
  exactly `["schemaVersion", "tool", "summary", "diagnostics"]` in order, and
  that a diagnostic's keys are in §8 order.
- Optional-field behaviour: a diagnostic with `suggestions` present serializes
  them as `{ message }` objects; a diagnostic without `suggestions` still emits
  `"suggestions": []`.
- Snapshot: `expect(formatJsonReport(report)).toMatchSnapshot()` for a small
  two-diagnostic report, paired with the semantic assertions above
  (`AGENTS.md` §"Testing" snapshot scope).

Red evidence: the new test fails to import `formatJsonReport` (module missing)
and `public-consumer`/`package-entry` fail on the missing export. Green: add the
module, export, and fixture entry; refresh the snapshot. Validation: `make all`.

### WI-2: Add the reviewed JSON contract fixture and its analyser-parity test

Implements the roadmap 2.4.3 success criterion ("JSON output is stable under
snapshot tests and includes the versioned envelope") and `docs/technical-design.md`
§8. Honours the single-sourced corpus rule (`docs/repository-layout.md`
§"Test and fixture boundaries"; roadmap 2.3.5).

Read first: `docs/technical-design.md` §8; `docs/repository-layout.md`
§"Test and fixture boundaries"; `tests/static-analysis/fixtures/corpus-support.ts`,
`tests/static-analysis/fixtures/invalid-workflows/corpus.ts`;
`src/cli/run-check.ts`, `src/static-analysis/workflow-lint.ts`. Skills:
`execplans`, `en-gb-oxendict`. Use `leta` to confirm the corpus helper exports
before importing them.

Work:

1. Choose the reviewed source input `missing-metadata/missing-meta.js` (yields a
   single `odw/meta-required` error, matching the §8 example rule). In the test,
   lint it in-process through `runCheck`/`lintWorkflowSource` with a **fixed
   logical file path** (for example `workflows/example.js`) so the emitted
   `file` is deterministic, then serialize with `formatJsonReport`.
2. Commit the golden artefact `tests/diagnostics/fixtures/json-contract.json`
   holding the reviewed serialized envelope (Biome will format it; that is
   fine — see below). Add a `/** @file */`-documented loader only if a helper is
   warranted; otherwise read it inline in the test.

Tests (Red first): add `tests/diagnostics/json-contract.test.ts`:

- Parity (binding): `JSON.parse(goldenText)` deep-equals
  `JSON.parse(formatJsonReport(liveReport))`, where `liveReport` is produced by
  linting the reviewed source fixture with the fixed logical path. This ties the
  golden to live analyser output and survives Biome's trailing-newline
  formatting.
- Envelope invariants: the golden has `schemaVersion === 1`,
  `tool.name === "odw-lint"`, a `summary` with the five count keys, and at least
  one diagnostic whose `rule` is `odw/meta-required` with a `span` and a `docs`
  path under `docs/rules/`.
- Snapshot: `expect(formatJsonReport(liveReport)).toMatchSnapshot()` pins the
  exact serializer bytes for the reviewed input (deterministic because the
  logical path is fixed).

Red evidence: the parity test fails before the golden exists / before the fixed
logical path is wired (absolute path mismatch). Green: commit the golden and
fix the logical path; refresh the snapshot after confirming the diff is the
intended envelope. Validation: `make all`.

Note on formatting: because `biome.jsonc` includes `tests/**/*`, run
`make check-fmt` (inside `make all`) so the committed `.json` is already
Biome-formatted; the structural parity assertion does not depend on its exact
byte layout. Do not add a Biome override for this fixture unless `make all`
shows a genuine conflict — if it does, record it in Surprises & Discoveries and
prefer structural comparison over disabling the formatter.

### WI-3: Add `--output-format full|json` to the explicit-path check CLI

Implements `docs/technical-design.md` §7.3 (the `--output-format` flag, default
`full`) while preserving §7.4 exit codes and the roadmap 2.4.1 read-failure
behaviour.

Read first: `docs/technical-design.md` §§7.3, 7.4; `src/cli/check-cli.ts`,
`src/cli/run-check.ts`, `src/cli/main.ts`; `tests/cli/check-cli.test.ts`,
`tests/cli/check-cli-corpus.e2e.test.ts`; `AGENTS.md` §§"Error Handling",
"Testing". Skills: `execplans`, `en-gb-oxendict`. Use `leta refs runCheckCli`
to confirm all call sites before changing the signature.

Work:

1. Extend `parseCheckArgs` in `src/cli/check-cli.ts` (or a small new
   `src/cli/check-args.ts` if `check-cli.ts` approaches 400 lines) to recognize
   `--output-format <value>` and `--output-format=<value>`, with implemented
   values `full` (default, current text) and `json`. Keep every other
   `-`-prefixed argument a usage error. Reject unknown formats (for example
   `--output-format json-lines`) with a stable usage error
   (`unsupported output format: <value>`) and exit `2`. Preserve the existing
   `usage: odw-lint check <workflow.js ...>` and `unknown option`/`unknown
   command` errors.
2. Route rendering by the parsed format: `full` keeps
   `formatTextDiagnostics`; `json` calls `formatJsonReport(outcome.report)` and
   writes it to stdout followed by a single newline. Read failures continue to
   go to stderr as `error: cannot read <path>: <message>` in both formats, and
   the exit code is unchanged (`checkDiagnosticsExitCode`).
3. Do not change `runCheck`, exit-code policy, or the read path.

Tests (Red first):

- Unit (`tests/cli/check-cli.test.ts`): `--output-format json` over the error
  fixture prints a parseable envelope with `schemaVersion === 1` and the first
  diagnostic `rule === "odw/meta-required"`, and returns `1`; over a clean
  fixture prints an envelope with an empty `diagnostics` array and returns `0`;
  `--output-format full` matches the current text output; an unknown format
  returns `2` with the stable usage error on stderr and empty stdout; a
  read-failure under `--output-format json` still writes the stderr line and
  returns `1`.
- e2e (`tests/cli/check-cli-corpus.e2e.test.ts` or a focused new
  `check-cli-json.e2e.test.ts`): spawn `bun run src/cli/main.ts check
  --output-format json <invalid fixture>`, parse stdout, assert
  `schemaVersion`, `tool.name`, `summary.errors >= 1`, first diagnostic `rule`,
  exit code `1`, and empty stderr. Assert structural fields only (absolute
  `file` path is not snapshotted).

Red evidence: the new `--output-format json` unit test fails because the parser
currently rejects the flag as an unknown option. Green: add parsing and routing.
Refactor: extract a `renderReport(format, outcome, writers)` helper if the CLI
branch grows. Validation: `make all`.

### WI-4: Document implemented JSON output across the guides

Implements `AGENTS.md` §"Documentation Maintenance" (keep docs current with
behaviour) and the `documentation-style-guide.md` conventions.

Read first: `docs/developers-guide.md` lines 34-49; `docs/users-guide.md`
§§"Command shape", "Diagnostic reports"; `docs/documentation-style-guide.md`;
`docs/repository-layout.md` §"Source boundaries" (read-only, for the scope
confirmation below). Skills: `execplans`, `en-gb-oxendict`,
`documentation-style-guide` conventions (80-column prose, 120-column code
blocks, dash bullets).

This work item edits exactly two files: `docs/developers-guide.md` and
`docs/users-guide.md`. `docs/repository-layout.md` is deliberately **not**
edited: its `src/diagnostics/` responsibility note (line 26: "text rendering,
JSON Schema support and report shapes") and its "Source boundaries" prose
(line 76: `src/diagnostics/` "owns diagnostic data and presentation contracts")
already describe the JSON reporter generically and do not enumerate reporter
files such as `text.ts` by name, so adding `report-json.ts` there would be
redundant. Because the file is not changed, it is excluded from this work item's
formatter invocation (see Decision Log ruling and Concrete steps step 4); this
keeps the formatter list to files the work item actually edits.

Work:

1. `docs/developers-guide.md`: update the deferred-features paragraph (lines
   47-49) so it no longer lists "JSON output" as deferred; state that
   `--output-format json` is implemented and renders the §8 envelope via
   `formatJsonReport`, while richer text formatting, other output formats,
   `--output-file`, discovery, and the wider flag surface remain deferred. Note
   the new `src/diagnostics/report-json.ts` module and the public
   `formatJsonReport` export.
2. `docs/users-guide.md`: in "Command shape", mark `--output-format json` (and
   the default `full` text) as available now, keeping JSON Lines/GitHub/GitLab/
   JUnit/SARIF listed as planned. Confirm the "Diagnostic reports" JSON example
   still matches the emitted envelope (it already shows `"suggestions": []`).
3. Do not tick the roadmap 2.4.3 checkbox in `docs/roadmap.md`; the workflow
   host flips it on merge. Only update the ExecPlan `Progress` section.

Tests: documentation-only; no code tests. Validation: `make all`,
`make markdownlint`, and `make nixie` (the last is a no-op-safe Mermaid check;
these guides contain no Mermaid, but run it per the markdown gate policy).

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-3`.

1. WI-1: create `src/diagnostics/report-json.ts`, add the export in
   `src/index.ts`, add `tests/diagnostics/report-json.test.ts`, update
   `tests/diagnostics/public-api-fixtures.ts`, refresh the
   `public-consumer` snapshot. Then:

   ```bash
   make all
   ```

   Expected: build, `check-fmt`, `whitespace-hygiene`, `lint`, `typecheck`, and
   `test` all pass; the new report-json suite and the public-api suites pass.
   Commit: `Add canonical JSON diagnostic report serializer`.

2. WI-2: add `tests/diagnostics/fixtures/json-contract.json` and
   `tests/diagnostics/json-contract.test.ts`. Then:

   ```bash
   make all
   ```

   Expected: the parity test proves the golden matches live analyser output.
   Commit: `Add JSON diagnostic contract fixture and parity test`.

3. WI-3: extend the CLI parser and rendering; add the CLI unit and e2e JSON
   tests. Then:

   ```bash
   make all
   ```

   Expected: `--output-format json` emits the envelope; exit codes unchanged.
   Commit: `Add JSON output format to check command`.

4. WI-4: update `docs/developers-guide.md` and `docs/users-guide.md` (the only
   two files this work item edits — `docs/repository-layout.md` is intentionally
   left unchanged, see WI-4); format only those two touched markdown files, then
   gate:

   ```bash
   bunx mdtablefix --in-place docs/developers-guide.md docs/users-guide.md
   bunx markdownlint-cli2 --fix docs/developers-guide.md docs/users-guide.md
   make all
   make markdownlint
   make nixie
   ```

   Expected: markdown lints clean; `make all` stays green. Commit:
   `Document implemented JSON check output`.

## Validation and acceptance

Deterministic commit gate for every work item: `make all` (build, formatting,
whitespace hygiene, lint, typecheck, tests). For the markdown-changing work item
(WI-4) additionally run `make markdownlint` and `make nixie`. The workflow host
re-runs the configured gates against committed HEAD; do not report gates green
unless every gate passed at HEAD.

Behavioural acceptance:

- `formatJsonReport(report)` returns the `docs/technical-design.md` §8 envelope
  with stable key order and `suggestions: []` present; pinned by the WI-1
  snapshot and structural tests, which fail before the module exists and pass
  after.
- The committed JSON contract fixture deep-equals the live analyser's serialized
  envelope for the reviewed source input (WI-2 parity test), and its snapshot is
  stable across runs.
- `bun run src/cli/main.ts check --output-format json <invalid fixture>` prints
  a parseable versioned envelope, exits `1`, and writes nothing to stderr;
  `--output-format full` reproduces the current text output; an unknown format
  exits `2` with a stable usage error (WI-3 unit + e2e tests).

Red-Green-Refactor evidence is recorded per work item above: each item adds its
smallest failing test first (missing export / missing golden / rejected flag),
then the minimal production change, then a refactor pass, rerunning `make all`
after each stage.

Quality criteria ("done"):

- Tests: new report-json, json-contract, and CLI JSON suites pass; existing
  suites (public-api, package-entry, check-cli, e2e corpus) stay green.
- Lint/typecheck: `make lint` and `make typecheck` clean; no new suppressions.
- Format: `make check-fmt` clean, including the committed `.json` fixture.
- Schema: emitted JSON conforms to `DIAGNOSTIC_REPORT_SCHEMA` (asserted
  structurally; no new validator dependency).

## Idempotence and recovery

Every work item is additive and re-runnable: creating modules, tests, and the
golden fixture is safe to repeat, and `make all` is idempotent. If a snapshot
fails, inspect the diff, confirm it is the intended envelope change, then update
with the Bun snapshot update flow; never blind-update. If `make check-fmt`
reformats the golden `.json`, re-commit the formatted file — the structural
parity assertion is unaffected. If a work item exceeds a tolerance, stop and
record the situation in the Decision Log before proceeding.

## Interfaces and dependencies

Prescriptive end-state signatures:

- In `src/diagnostics/report-json.ts`:

  ```ts
  export const formatJsonReport: (report: DiagnosticReport) => string;
  ```

  Emits the `docs/technical-design.md` §8 envelope via an explicit canonical
  projection and `JSON.stringify(projection, null, 2)`, no trailing newline.

- In `src/index.ts`: add
  `export { formatJsonReport } from "./diagnostics/report-json";`.

- In `src/cli/check-cli.ts` (or `src/cli/check-args.ts`): parse
  `--output-format full|json` (default `full`); the parsed shape carries the
  selected format, and `runCheckCli` routes rendering to `formatTextDiagnostics`
  or `formatJsonReport`. No change to `runCheck` or `checkDiagnosticsExitCode`.

No new runtime or dev dependencies. Reuse `JSON.stringify`, the existing
`DiagnosticReport`/`DIAGNOSTIC_REPORT_SCHEMA` contracts, the shared diagnostic
test fixtures (`tests/diagnostics/fixtures.ts`), and the single-sourced corpus
helpers under `tests/static-analysis/fixtures/`.

## Revision note

- 2026-07-06: Initial DRAFT. Decomposed roadmap 2.4.3 into four atomic work
  items (serializer + export, contract fixture + parity test, CLI flag, docs),
  pinned the `suggestions`/`docs` presence fork and the canonical-projection and
  read-failure decisions in the Decision Log, and set path-safe validation via
  `make all` / `make markdownlint` / `make nixie`. No prior design-review points
  to address (round 1).
- 2026-07-06: Round 2 design-review revision. Resolved the sole blocking point:
  WI-4 previously listed `docs/repository-layout.md` as an optional ("if needed")
  edit yet formatted it unconditionally in Concrete steps step 4, risking
  unrelated formatter churn if the implementer left it unedited. Verified against
  the worktree that `docs/repository-layout.md:26` and its "Source boundaries"
  prose (`:76`) already cover the JSON reporter generically without enumerating
  reporter files by name, so the edit is genuinely unnecessary. Dropped
  `docs/repository-layout.md` from WI-4's work list and from both formatter
  commands (WI-4 now edits exactly `docs/developers-guide.md` and
  `docs/users-guide.md`), demoted the roadmap-checkbox note to step 3, added a
  Decision Log entry recording the exclusion, and kept `repository-layout.md` as
  read-only scope-confirmation context. Every remaining formatter path now names
  a file the work item actually edits.
- 2026-07-06: WI-1 implementation revision. Marked the plan `IN PROGRESS` and
  ticked the serializer/export work item after adding `formatJsonReport`,
  package-entry/public-consumer coverage, diagnostics architecture fixture
  updates, and the required `docs/contents.md` ExecPlan link. Recorded the gate
  discoveries so WI-2 through WI-4 can continue from the committed serializer
  without mistaking the contents-index fix for user-facing JSON documentation.
- 2026-07-06: WI-4 implementation revision. Marked the plan `COMPLETE`, ticked
  the guide-documentation work item, and recorded the completed documentation
  surface plus the `mdtablefix --in-place` deviation from the concrete command
  example.

## Addenda

- [ ] 2.4.3.1. Enforce the JSON schema and serializer contract.
  - Source: audit:2.4.3; severity: medium.
  - Scope: reconcile `DIAGNOSTIC_REPORT_SCHEMA` required fields with the
    guaranteed `formatJsonReport` projection, and add a direct
    schema-conformance test across severity, optional `docs`, and
    `suggestions` variants without introducing a validator dependency.
