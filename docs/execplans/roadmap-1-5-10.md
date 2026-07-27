# Add an executable artefact check for recorded review evidence

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.5.10 (`docs/roadmap.md` line 352, under section 1.5 "Harden
roadmap-workflow review gates") closes a trust gap in the review-evidence
system built by tasks 1.5.6-1.5.9. Today `make review-evidence` prints its
report to stdout only (`tests/build-gate/review-evidence-cli.ts` calls
`emitCliReport`, which writes to `process.stdout`). Nothing persists that
report, and nothing verifies a report was recorded. A roadmap review or audit
can therefore *claim* review-evidence compliance without leaving any artefact
the audit harness can inspect. This is the honour-system gap AGENTS.md "Roadmap
Review & Audit Evidence" describes as "not optional".

After this change a reviewer or the df12-build audit harness can:

1. Persist the review-evidence report to a deterministic artefact path by
   running `make review-evidence` with a recording target set (via the
   `--record=<path>` flag or the `ODW_LINT_REVIEW_EVIDENCE_PATH` environment
   variable).
2. Run a new executable build gate, `make review-evidence-artefact`, that
   reads that artefact and **rejects missing or unusable recorded evidence**
   with a non-zero exit code.

Observable success (matches the roadmap success criterion "a completed roadmap
review or audit cannot claim review-evidence compliance unless the recorded
report is available to the audit harness"):

- With no recorded artefact present, `make review-evidence-artefact` prints
  `Review evidence artefact: missing` and exits non-zero (1).
- After
  `bun run tests/build-gate/review-evidence-cli.ts --record=<path> --scrutineer=available`
  writes a `verified` report to `<path>`,
  `ODW_LINT_REVIEW_EVIDENCE_PATH=<path> make review-evidence-artefact` prints
  `Review evidence artefact: present` naming the recorded status, and exits 0.
- A file that is not a genuine review-evidence report (or records only a
  `usage-error`) is rejected as `invalid` with exit 1.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Work only inside the worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-10`. Never edit the
  root/control worktree.
- Do not change the meaning of the existing `make review-evidence` exit codes
  (`tests/build-gate/review-evidence-cli.ts:311-325`): 0 verified, 1 failed, 2
  usage-error, 3 degraded (documented in AGENTS.md "Roadmap Review & Audit
  Evidence": "A `failed` (1) or `usage-error` (2) result must block the
  review"). Recording is strictly additive and **never mutates the process exit
  code**: a run that would exit 0/1/3 without recording must still exit 0/1/3
  with recording enabled — including when the recording write itself fails. A
  failed recording write is surfaced on stderr as a diagnostic and enforced by
  the new `make review-evidence-artefact` gate (which reports the artefact
  `missing` and exits 1), *not* by overloading exit code 2 or inventing a new
  code on the review-evidence CLI. Exit code 2 keeps its single documented
  meaning: a usage error (a malformed invocation), never an I/O failure of an
  otherwise-valid run. This resolves the round-1 design-review contradiction
  (see Decision Log, "recording write failures preserve the exit code").
- Do not add `review-evidence-artefact` (or `review-evidence`) to `make all`.
  Both are reviewer/audit gates, not recursive commit-gate steps (AGENTS.md
  "Roadmap Review & Audit Evidence"; developers-guide.md line 240). The
  Makefile test `makefile.test.ts` "keeps review evidence outside the full
  gate" must keep passing, and an equivalent assertion must cover the new gate.
- Every new TypeScript file under `tests/` must stay within the 400 physical
  line limit enforced by `tests/build-gate/file-size.test.ts` (AGENTS.md "Keep
  file size manageable"). Keep each module single-responsibility.
- Reuse the existing shared build-gate seams; do not clone their boilerplate:
  `resolveCliWriters` / `emitCliReport` from `tests/build-gate/cli-support.ts`
  and the recorded-report format produced by `formatReviewEvidenceResult`
  (`tests/build-gate/review-evidence-report.ts`). AGENTS.md "Abstraction /
  adapter / helper policy" requires sweeping for an existing equivalent before
  adding a new helper.
- Follow en-GB Oxford spelling ("-ize"/"-yse"/"-our", "artefact") in all prose,
  comments, and commit messages (AGENTS.md "Use consistent spelling and
  grammar").
- Do not commit the recorded evidence artefact. It is per-run reviewer output;
  its directory must be git-ignored so a stale report cannot masquerade as
  current evidence in review diffs.

## Tolerances (exception triggers)

- Scope: if implementation requires touching more than 12 files or a net
  +700 lines of code, stop and escalate.
- Interface: if any existing exported signature in `review-evidence.ts`,
  `review-evidence-report.ts`, `review-evidence-cli.ts`, or `cli-support.ts`
  must change (as opposed to being extended with new optional fields/exports),
  stop and escalate.
- Dependencies: if any new runtime or dev dependency is required, stop and
  escalate. This task must be implementable with the current toolchain
  (`bun test`, `fast-check`, Biome, Oxlint, `tsc`).
- Iterations: if a gate (`make all`) still fails after 3 focused fix attempts
  on the same work item, stop and escalate.
- Ambiguity: if the intended artefact-recording contract for the df12-build
  audit harness cannot be satisfied by a documented flag/env plus a check gate
  (for example if a reviewer expects the artefact committed to Git), stop and
  present options.

## Risks

- Risk: recording writes real files during unit tests and leaves scratch
  artefacts, or makes tests non-deterministic. Severity: medium. Likelihood:
  medium. Mitigation: inject a file-writer seam into the recording path and a
  file-reader seam into the check CLI (mirroring the existing `createRunner`
  and writer injection). Unit tests use in-memory fakes; only the process smoke
  tests touch the filesystem, and they write under `mkdtempSync` temp dirs and
  clean up in `finally`, exactly like `review-evidence-cli-smoke.test.ts`.
- Risk: the artefact check re-judges review status and duplicates
  `classifyReviewEvidence`, causing drift. Severity: medium. Likelihood:
  medium. Mitigation: the check is a *presence-and-authenticity* gate. It
  parses only the leading `Review evidence: <status>` line the formatter
  already emits and reports the recorded status verbatim; it never re-runs
  gates or re-derives a verdict. A property test pins the round-trip
  `classifyRecordedEvidence(formatReviewEvidenceResult(result))`.
- Risk: scope creep into staleness/provenance checking (does the recorded
  report match the current commit?). Severity: low. Likelihood: medium.
  Mitigation: explicit non-goal (see Decision Log). The success criterion is
  availability of a genuine recorded report, not provenance. A follow-up
  roadmap task is the correct home for staleness detection.
- Risk: because a failed recording write preserves the exit code (Decision Log,
  "recording write failures preserve the exit code"), a stale valid artefact
  left at the resolved path by an earlier run could let
  `make review-evidence-artefact` report `present` even though the current run
  failed to record — masking the write failure. Severity: low. Likelihood: low.
  Mitigation: the recorder emits a loud stderr diagnostic on write failure, and
  the write overwrites the target deterministically on the common path. The
  residual "stale artefact from a prior run masks a fresh failure" case is a
  provenance concern, which is an explicit non-goal for 1.5.10 (Decision Log)
  and belongs to the same follow-up staleness/provenance task. This is recorded
  here so the residual is documented, not silently accepted.
- Risk: a default artefact path collides with an existing tracked file or an
  ignored path with different semantics. Severity: low. Likelihood: low.
  Mitigation: use a new, clearly named ignored directory `.review-evidence/`
  (added to `.gitignore`) with default report file
  `.review-evidence/report.txt`; confirm no such path exists before writing.

## Progress

- [x] WI1: Pure recorded-evidence classifier and shared artefact-path resolver
      (`tests/build-gate/review-evidence-artefact.ts`) with unit and property
      tests.
- [x] WI2: Recorded-evidence report formatter
      (`tests/build-gate/review-evidence-artefact-report.ts`) with unit and
      snapshot tests.
- [x] WI3: Artefact-check CLI
      (`tests/build-gate/review-evidence-artefact-cli.ts`) with unit tests and
      a real-Bun process smoke test.
- [x] WI4: Wire the `review-evidence-artefact` Makefile target and extend
      `makefile.test.ts`.
- [x] WI5: Add report recording to the review-evidence CLI (`--record=`/env,
      injected writer, default path) with unit tests and a recording smoke test.
- [x] WI6: Documentation and contract updates (AGENTS.md, developers-guide.md,
      `.gitignore`) and extend `review-evidence-audit.test.ts`.

## Surprises & discoveries

- Observation: the build-gate CLIs live under `tests/build-gate/`, not `src/`,
  yet are production reviewer tooling invoked by Makefile targets. Evidence:
  `Makefile:39-46`; `docs/developers-guide.md:208-218`. Impact: new modules
  belong under `tests/build-gate/` and are covered by the `bun test` suite and
  the file-size guard, not by the package export surface.
- Observation: there is no Gherkin/`.feature` usage in this repository; the
  behavioural layer for build gates is real-Bun process smoke tests. Evidence:
  `tests/build-gate/review-evidence-cli-smoke.test.ts`; no `.feature` files
  under `tests/`. Impact: this plan uses process smoke tests as the
  behavioural/e2e layer, as AGENTS.md "Behavioural tests" permits deterministic
  step definitions and the repository convention is process smoke coverage.
- Observation: WI1 needed the report status prefix exported from
  `review-evidence-report.ts`, rather than duplicating the literal in the
  recorded-artefact parser. Evidence: CodeRabbit review after WI1 deterministic
  gates; shared `REVIEW_EVIDENCE_REPORT_PREFIX` now feeds the formatter and
  parser. Impact: future report heading changes have one source of truth.
- Observation: blank or padded artefact paths need normalization before default
  fallback resolution. Evidence: CodeRabbit review after WI1 deterministic
  gates; unit coverage now covers blank and padded flag/environment values.
  Impact: `--record=` and blank harness environment values cannot suppress the
  default path, and non-blank paths are trimmed before use.
- Observation: the recorded-evidence artefact report formatter can stay pure
  and independent of file-system concerns. Evidence:
  `review-evidence-artefact-report.test.ts` covers all four result variants and
  snapshots the reviewer-facing `present` and `invalid` reports. Impact: WI3
  can focus on CLI parsing, reading, stream selection, and exit codes without
  owning report shape.
- Observation: WI2 exhausted the allowed CodeRabbit retry budget after one
  rate-limited attempt and three retry attempts. Evidence: the final retry
  reported low helper-test and assertion-flexibility findings, which were fixed
  locally before deterministic gates. Impact: WI2 proceeds on deterministic
  gates rather than another CodeRabbit invocation, preserving the workflow
  retry limit.
- Observation: unreadable evidence is handled by the artefact checker as
  invalid recorded evidence, not as CLI misuse. Evidence:
  `review-evidence-artefact-cli.test.ts` covers read errors returning exit 1
  with an invalid report; unknown flags still return usage-error exit 2.
  Impact: the check keeps exit 2 reserved for malformed invocation while
  failing closed on missing, invalid, or unreadable artefacts.
- Observation: `review-evidence-artefact` is a reviewer/audit target only and
  remains outside `make all`. Evidence: `makefile.test.ts` dry-runs the target
  directly and asserts the full gate does not invoke either review-evidence CLI;
  `mbake validate Makefile` and `checkmake Makefile` passed. Impact: the new
  executable check is available to audit workflows without making the commit
  gate recursively depend on reviewer artefacts.
- Observation: review-evidence recording must preserve the classifier exit code
  even when the artefact write fails. Evidence:
  `review-evidence-cli-record.test.ts` covers verified and degraded recording,
  usage-error non-recording, flag-over-environment precedence, and a throwing
  writer that emits a diagnostic while returning the original exit code.
  Impact: the review CLI remains compatible with the existing audit contract,
  and the separate artefact check owns missing or unusable recorded evidence.
- Observation: real process recording can be smoke-tested without touching the
  repository default artefact path. Evidence:
  `review-evidence-cli-record-smoke.test.ts` records to a temp file, compares
  it with stdout, and runs the artefact-check CLI against that file. Impact:
  WI5 proves the CLI integration end to end while leaving `.review-evidence/`
  free for operator or harness runs.
- Observation: moving recording filesystem concerns into
  `review-evidence-recording.ts` keeps the review-evidence CLI under the
  400-line guard. Evidence: the first WI5 deterministic gate failed because
  `review-evidence-cli.ts` reached 410 lines; after the split it is 353 lines,
  and the focused recording tests still pass. Impact: the recording path has a
  named ownership boundary and the file-size guard stays useful rather than
  being loosened.
- Observation: WI5 exhausted the allowed CodeRabbit retry budget after one
  rate-limited attempt, one completed review, one infrastructure stall, and one
  completed retry. Evidence: the final retry reported a minor JSDoc example
  issue and two trivial snapshot-style findings; the current patch fixes the
  JSDoc example and uses an inline snapshot for the verified recorded report.
  The reported missing-evidence formatter finding was already satisfied by an
  inline snapshot in `review-evidence-artefact-report.test.ts`. Impact: WI5
  proceeds on deterministic gates after addressing the actionable current
  findings within the workflow retry limit.
- Observation: the documentation contract now names both the recording action
  and the executable artefact check. Evidence: `AGENTS.md` and
  `docs/developers-guide.md` document `--record=`,
  `ODW_LINT_REVIEW_EVIDENCE_PATH`, `.review-evidence/report.txt`, and
  `make review-evidence-artefact`; `review-evidence-audit.test.ts` asserts the
  AGENTS.md section retains those contract markers. Impact: future edits cannot
  quietly remove the audit-harness requirement to verify that recorded evidence
  is actually available.

## Decision log

- Decision: split recording (a small addition to `review-evidence-cli.ts`) from
  the artefact check (a new independent gate). Rationale: the roadmap task
  names two distinct deliverables — "persist the report" and "add a build-gate
  check that rejects missing recorded evidence". Keeping them separate
  preserves single responsibility and lets the check be tested with
  hand-authored fixtures independent of a full re-run. Date/Author: 2026-07-04,
  planning agent.
- Decision: the artefact check is presence-and-authenticity only; it accepts a
  recorded `verified`, `failed`, or `degraded` report as *present* evidence and
  rejects only a missing file, an unparseable file, or a `usage-error` record.
  Rationale: AGENTS.md states "The recorded report is the deliverable whatever
  its classification." Compliance means the report was recorded, not that it
  passed. Re-judging status is the review-evidence gate's job. Date/Author:
  2026-07-04, planning agent.
- Decision: staleness/provenance (does the report match the current tree or
  commit?) is out of scope for 1.5.10. Rationale: the success criterion is
  availability of a genuine recorded report. Provenance checking is a
  materially larger design and warrants its own roadmap task; adding it here
  would breach the scope tolerance. Date/Author: 2026-07-04, planning agent.
- Decision: default artefact path `.review-evidence/report.txt`, resolved by a
  single shared helper both the recorder and the checker import, with the
  directory git-ignored. Rationale: one source of truth for the path prevents
  recorder/checker drift (AGENTS.md abstraction policy); git-ignoring prevents
  a stale committed report from masquerading as current evidence. Date/Author:
  2026-07-04, planning agent.
- Decision: on `usage-error`, the review-evidence CLI records nothing.
  Rationale: a broken invocation must leave no artefact so the check fails as
  "missing", rather than persisting a `usage-error` string that the check would
  then have to special-case as invalid anyway. Date/Author: 2026-07-04,
  planning agent.
- Decision: recording write failures preserve the exit code — a failed
  recording write does NOT change the review-evidence CLI's process exit code
  and must not reuse exit 2. Rationale: round-1 design review flagged that the
  earlier draft returned exit 2 on a recording-write failure, which (a)
  violated this plan's own hard Constraint that "a run that would exit 0/1/3
  without recording must still exit 0/1/3 with recording enabled" and (b)
  overloaded exit code 2's single documented meaning — `usage-error`, a
  malformed invocation — per AGENTS.md "Roadmap Review & Audit Evidence". Three
  options were weighed: overload exit 2 (rejected: breaks the invariant and the
  AGENTS.md contract); add a new exit code 4 (rejected: still makes a
  `verified` run exit non-`0` when the write fails, so it still breaches the
  literal invariant, and it widens the documented exit-code surface for no
  enforcement gain); or preserve the exit code and delegate enforcement to the
  artefact check (**chosen**). The chosen handling keeps the exit-code contract
  pristine: the recorder surfaces the write failure loudly on stderr, and
  `make review-evidence-artefact` (WI3) is the fail-closed enforcement point —
  a run whose write did not land is reported `missing`/`invalid` and exits 1,
  blocking the review. This is defence in depth by design: the artefact check
  exists precisely so recording is verified independently rather than trusted
  from the recorder's own exit code. Date/Author: 2026-07-04 (round 2),
  planning agent.

## Outcomes & retrospective

Roadmap task 1.5.10 is complete. The implementation adds a shared recorded
evidence classifier, an artefact-check report formatter, a standalone
`review-evidence-artefact` CLI, the `make review-evidence-artefact` target, and
optional recording on the existing review-evidence CLI. The audit contract is
documented in AGENTS.md and `docs/developers-guide.md`, the default artefact
directory is git-ignored, and `docs/roadmap.md` marks the task complete.

Acceptance behaviour is covered by process smoke tests: missing artefacts are
rejected, recorded verified reports are accepted, and usage-error reports are
not recorded. The final work item preserves the established
`make review-evidence` exit-code contract while making the artefact check the
fail-closed enforcement point for missing or unusable recorded evidence.

## Context and orientation

The reader needs no prior plan. Key facts about the current tree:

- Build gates are TypeScript CLIs under `tests/build-gate/`, each wired to a
  `.PHONY` Makefile target that runs `bun run tests/build-gate/<name>.ts`
  (`Makefile:39-46`). `make all` deliberately excludes `review-evidence`,
  `branch-freshness`, and `markdownlint` (`Makefile:5`).
- The review-evidence gate is split into pure classification
  (`tests/build-gate/review-evidence.ts`, `classifyReviewEvidence`,
  `ReviewEvidenceResult` union with statuses
  `verified | failed | degraded | usage-error`), report formatting
  (`tests/build-gate/review-evidence-report.ts`, `formatReviewEvidenceResult`),
  and the CLI (`tests/build-gate/review-evidence-cli.ts`,
  `runReviewEvidenceCli`, `exitCodeFor`).
- The report text is stable and greppable. Every terminal classification starts
  with a line `Review evidence: <status>` and ends with a trailing newline
  (`review-evidence-report.ts:39-52`; `usage-error` branch at lines 31-32). A
  `verified` example (`review-evidence-cli-smoke.test.ts:80-86`):

      Review evidence: verified
      - gate make all: passed
      - gate make markdownlint: passed
      - gate make nixie: passed
      - dual-review path: scrutineer (primary; scrutineer available)

- Shared CLI plumbing lives in `tests/build-gate/cli-support.ts`:
  `resolveCliWriters(overrides?)` returns `{ writeOut, writeErr }` defaulting
  to the real process streams, and `emitCliReport({ report, toErr, writers })`
  dispatches one formatted report to the chosen stream. All three existing gate
  CLIs use these.
- Reviewer availability parsing lives in
  `tests/build-gate/review-evidence-availability.ts`
  (`deriveHarnessPathAvailability`, env keys `ODW_LINT_REVIEW_SCRUTINEER`,
  `ODW_LINT_REVIEW_CODERABBIT`, `ODW_LINT_REVIEW_LOCAL_SELF_RUN`). No change is
  needed there; the recording feature is orthogonal.
- The audit contract test `tests/build-gate/review-evidence-audit.test.ts`
  reads the `## Roadmap Review & Audit Evidence` section of `AGENTS.md` and
  asserts required patterns are present. Extending the contract means extending
  both the prose and this test.
- Test conventions (from AGENTS.md "Testing" and the existing suite):
  `bun test`; pure logic in `<name>.test.ts`; property tests with `fast-check`
  in `<name>.property.test.ts`; Bun snapshots for stable output contracts; real
  process behaviour in `<name>-smoke.test.ts` using `Bun.spawnSync` under a
  `mkdtempSync` temp dir; Makefile wiring in `makefile.test.ts` via
  `make --dry-run`.

New terms used in this plan:

- **Recorded evidence artefact**: the review-evidence report text persisted to a
  file (default `.review-evidence/report.txt`) so an audit harness can read it.
- **Artefact check**: the new gate that reads that file and rejects missing or
  unusable evidence.

## Plan of work

Each work item is independently committable and passes `make all`. Follow
Red-Green-Refactor: add the failing test first, then the minimal
implementation, then clean up. Load the `leta` skill for symbol navigation and
the `python-router`/`rust-router` note does not apply — this is TypeScript;
follow AGENTS.md "TypeScript Guidance". Where verification depth is warranted,
consult the `hypothesis`/`crosshair`/`mutmut` skills' conceptual guidance, but
this repository's property tool is `fast-check` (AGENTS.md "Invariant testing").

### WI1: Pure recorded-evidence classifier and shared path resolver

Docs to read: AGENTS.md "TypeScript Guidance" (runtime validation,
discriminated unions, error handling), `docs/developers-guide.md:208-218` (gate
module responsibilities),
`docs/complexity-antipatterns-and-refactoring-strategies.md` (keep functions
small, avoid primitive obsession). Skills: `leta` (navigate
`review-evidence.ts` / `review-evidence-report.ts`), `fast-check` guidance via
AGENTS.md "Invariant testing".

Create `tests/build-gate/review-evidence-artefact.ts` (pure, no I/O):

- Export `type RecordedStatus = "verified" | "failed" | "degraded"` — the
  terminal statuses that count as a genuine completed review (a subset of
  `ReviewEvidenceResult["status"]`, excluding `usage-error`).
- Export a discriminated union `RecordedEvidenceResult`:
  - `{ readonly outcome: "present"; readonly path: string; readonly status:
    RecordedStatus }`
  - `{ readonly outcome: "missing"; readonly path: string }`
  - `{ readonly outcome: "invalid"; readonly path: string; readonly reason:
    string }`
  - `{ readonly outcome: "usage-error"; readonly message: string }`
- Export `parseRecordedStatus(content: string): RecordedStatus | undefined` —
  read the first line, require the exact prefix `Review evidence:` followed by
  one space, and map the remaining token; return `undefined` when the prefix is
  absent or the status is not one of the three terminal statuses (a recorded
  `usage-error` or any other token is not a completed review).
- Export
  `classifyRecordedEvidence(input: { readonly path: string; readonly content:`
  `string | undefined }): RecordedEvidenceResult`:
  - `content === undefined` → `missing`.
  - content present but `content.trim()` empty → `invalid` (reason
    "recorded evidence file is empty").
  - `parseRecordedStatus` undefined → `invalid` (reason
    "recorded evidence is not a completed review report").
  - otherwise → `present` with the parsed status.
- Export
  `resolveEvidenceArtefactPath(input: { readonly flagValue?: string; readonly env:`
  `NodeJS.ProcessEnv }): string` — precedence flag value, then
  `env.ODW_LINT_REVIEW_EVIDENCE_PATH`, then the default
  `.review-evidence/report.txt`. Export a `DEFAULT_EVIDENCE_ARTEFACT_PATH`
  constant for reuse and testing.

Tests (Red first): `tests/build-gate/review-evidence-artefact.test.ts` covering
present (each of the three statuses), missing, empty, non-report content,
recorded `usage-error` rejected as invalid, and path precedence (flag > env >
default). Property test
`tests/build-gate/review-evidence-artefact.property.test.ts` using
`fast-check`: for an arbitrary terminal `ReviewEvidenceResult`, feeding
`formatReviewEvidenceResult(result)` through `classifyRecordedEvidence` yields
`present` with a status equal to the result's status. This pins the
recorder/checker round-trip and guards against formatter drift.

Validation: `make all`.

### WI2: Recorded-evidence report formatter

Docs to read: `docs/developers-guide.md` build-gate report guidance;
`review-evidence-report.ts` and `branch-freshness-report.ts` for the stable,
one-fact-per-line, trailing-newline house style. Skills: `leta`.

Create `tests/build-gate/review-evidence-artefact-report.ts` exporting
`formatRecordedEvidenceResult(result: RecordedEvidenceResult): string`,
mirroring `formatReviewEvidenceResult`'s shape:

- `present` → `Review evidence artefact: present\n- recorded status: <status>\n-
  artefact path: <path>\n`
- `missing` → `Review evidence artefact: missing\n- artefact path: <path>\n`
- `invalid` → `Review evidence artefact: invalid\n- artefact path: <path>\n-
  reason: <single-line reason>\n`
- `usage-error` → `Review evidence artefact: usage-error\n- usage error:
  <single-line message>\n`
- Include a private `singleLine` collapse (as in `review-evidence-report.ts:86`)
  and an `assertNever` exhaustiveness guard.

Tests (Red first): `tests/build-gate/review-evidence-artefact-report.test.ts`
with semantic assertions for each variant, plus a focused Bun snapshot
(`toMatchSnapshot`) for the `present` and `invalid` renderings to lock the
reviewer-facing contract (AGENTS.md "Snapshot scope": pair snapshots with
semantic assertions). The snapshot lands under
`tests/build-gate/__snapshots__/` automatically.

Validation: `make all`.

### WI3: Artefact-check CLI

Docs to read: `whitespace-hygiene.ts` (the closest CLI shape: read facts,
format outcome, `emitCliReport`, module-main guard), `cli-support.ts`,
`review-evidence-cli-smoke.test.ts` (process smoke pattern). Skills: `leta`.

Create `tests/build-gate/review-evidence-artefact-cli.ts`:

- Export `type ReviewEvidenceArtefactExitCode = 0 | 1 | 2`.
- Export `runReviewEvidenceArtefactCli(args, options)` where `options` allows
  injecting `readFile?: (path: string) => string | undefined` (default reads via
  `node:fs` `readFileSync` in UTF-8, mapping `ENOENT` to `undefined` and other
  errors to an invalid unreadable-evidence classification), `writeOut`/
  `writeErr`, `env`, and `cwd`.
- Parse args: accept `--evidence-path=<path>`; any other token → `usage-error`
  (`unknown option: <arg>`), matching the review-evidence CLI's flag discipline
  (`review-evidence-cli.ts:300-303`). Resolve the path with
  `resolveEvidenceArtefactPath`.
- Resolve the on-disk path against `cwd` (default `process.cwd()`) so `make`
  invocation from the repo root reads `.review-evidence/report.txt` there. Read
  content, call `classifyRecordedEvidence`, format via
  `formatRecordedEvidenceResult`,
  `emitCliReport({ report, toErr: outcome is not "present", writers })`.
- Exit codes: `present` → 0; `missing`/`invalid`/unreadable evidence → 1
  (rejects missing or unusable recorded evidence); `usage-error` (bad flag) → 2.
- Add the module-main guard identical to the other CLIs.

Tests (Red first): `tests/build-gate/review-evidence-artefact-cli.test.ts` with
an injected `readFile` fake and captured writers (`createCapturedCliOutput` from
`git-support.ts`) covering present/missing/invalid/usage-error and the
read-error→exit-1 path; assert both exit code and emitted text/stream.
Behavioural smoke:
`tests/build-gate/review-evidence-artefact-cli-smoke.test.ts` runs the CLI as a
real `Bun.spawnSync` child under a `mkdtempSync` temp cwd, asserting exit 1
with no artefact and exit 0 after writing a `verified` report file, cleaning up
in `finally`.

Validation: `make all`.

### WI4: Wire the Makefile target

Docs to read: `Makefile`, `makefile.test.ts`, `docs/developers-guide.md` "Bun
Scripts"/build-gate section. Skills: `leta`; consult `mbake`/`checkmake`
(available tooling, AGENTS.md "Additional tooling") to validate the Makefile.

- Add `review-evidence-artefact` to the `.PHONY` list and a target:

      review-evidence-artefact: ## Check recorded review evidence artefact
      	bun run tests/build-gate/review-evidence-artefact-cli.ts

  Keep it out of `all` (Constraints).
- Extend `makefile.test.ts`: add `"review-evidence-artefact"` to the
  `MakeTarget` union; add a test "documents the review-evidence artefact target
  and wires it through Bun" asserting the dry-run output contains
  `bun run tests/build-gate/review-evidence-artefact-cli.ts` and not
  `bun install`; and extend/duplicate the "keeps review evidence outside the
  full gate" assertion so the `all` dry-run does not contain the artefact CLI
  path.

Tests (Red first): the new `makefile.test.ts` cases fail before the Makefile
edit and pass after. Validate the Makefile with `mbake validate Makefile`.

Validation: `make all`.

### WI5: Add report recording to the review-evidence CLI

Docs to read: `review-evidence-cli.ts` (current flag parsing and
`runReviewEvidenceCli` flow), `git-support.ts:263-272` (`writeRepositoryFile`
pattern for `mkdirSync` + `writeFileSync`), AGENTS.md "Error Handling"
(boundary errors) and "Roadmap Review & Audit Evidence". Skills: `leta`.

- Extend `RunReviewEvidenceCliOptions` with
  `writeArtefact?: (path: string, content: string) => void` (injectable;
  default creates parent dirs and writes UTF-8, reusing the
  `mkdirSync({recursive:true})` + `writeFileSync` idiom; factor a tiny local
  writer rather than importing test fixture helpers).
- Extend flag parsing to accept `--record=<path>` and read
  `env.ODW_LINT_REVIEW_EVIDENCE_PATH`; resolve with
  `resolveEvidenceArtefactPath` from WI1. Recording is enabled only when a flag
  or env value is present, so default runs and every existing unit test remain
  no-write.
- After formatting and emitting the report, if recording is enabled and the
  result is a terminal classification (not `usage-error`), write the exact
  report text to the resolved path *before* returning. On `usage-error`, record
  nothing (Decision Log). If the write throws, catch it at the boundary (do not
  let an opaque `fs` error escape — AGENTS.md "Error Handling" boundary-error
  rule), emit a stable stderr diagnostic line
  (`review evidence recording failed: <single-line reason>`), and **return the
  unchanged classification exit code** (`exitCodeFor(result)`, i.e. 0/1/3). The
  recording write **never** changes the process exit code (Constraints): a
  `verified` run that fails to record still exits 0, a `degraded` run still
  exits 3, a `failed` run still exits 1. Enforcement that the artefact actually
  landed is delegated to `make review-evidence-artefact` from WI3, which fails
  closed (`missing` → exit 1) when the write did not produce a usable file.
  Reusing exit 2 here would overload its documented `usage-error` meaning and
  break the Constraints invariant, so it is explicitly rejected (Decision Log).

Tests (Red first): extend `tests/build-gate/review-evidence-cli.test.ts` (or add
`review-evidence-cli-record.test.ts` if the file nears the 400-line limit —
check first with the file-size guard) using an injected `writeArtefact` spy:
assert the report text is written for `verified`/`degraded`, that the path is
taken from `--record=` and from env, that `usage-error` writes nothing, and
that a throwing `writeArtefact` preserves the classification exit code (a
`verified` run with a throwing writer still returns 0, a `degraded` run still
returns 3) while emitting the stable `review evidence recording failed:` line
on stderr — explicitly pinning that a recording failure does not become exit 2.
Also assert exit codes are byte-for-byte unchanged versus the same run with
recording disabled. Add a recording case to the process smoke suite
(`review-evidence-cli-smoke.test.ts` or a sibling) that runs the real CLI with
`--record=<tempfile>` and asserts the file exists with the expected first line.

Validation: `make all`.

### WI6: Documentation and contract updates

Docs to read: `docs/documentation-style-guide.md` (wrapping, footnotes, en-GB
Oxford spelling), AGENTS.md "Roadmap Review & Audit Evidence" and "Markdown
Guidance", `docs/developers-guide.md:229-275`. Skills: `en-gb-oxendict`,
`changelog` not required. Format only touched Markdown: run `mdtablefix` then
`markdownlint-cli2 --fix` on the specific files edited.

- AGENTS.md "Roadmap Review & Audit Evidence": add that the harness must record
  the report to the evidence artefact (via `--record=` or
  `ODW_LINT_REVIEW_EVIDENCE_PATH`) and run `make review-evidence-artefact`,
  which rejects a missing or unusable recorded report; name the default path
  `.review-evidence/report.txt`; state the check's exit codes (0 present, 1
  missing/invalid, 2 usage-error). Also state explicitly that recording is
  additive on `make review-evidence`: enabling recording never changes its
  existing exit codes (0/1/2/3 keep their documented meanings), and a failed
  recording write is surfaced on stderr and caught by
  `make review-evidence-artefact` (reported `missing`), not by changing the
  review-evidence exit code — so exit 2 continues to mean only a usage error.
  This keeps the AGENTS.md exit-code contract consistent with WI5's handling
  and is guarded by the extended `review-evidence-audit.test.ts` contract
  patterns.
- `docs/developers-guide.md`: document the new target, the recording flag/env,
  the default artefact path, and the artefact-check exit codes, alongside the
  existing review-evidence documentation.
- `.gitignore`: add `.review-evidence/`.
- Extend `tests/build-gate/review-evidence-audit.test.ts` contract checks with a
  pattern requiring `make review-evidence-artefact` to be named in the
  AGENTS.md section (this test is the executable guard that the contract prose
  stays present). Confirm the existing "record" and coderabbit patterns still
  match.

Tests (Red first): the new contract pattern in `review-evidence-audit.test.ts`
fails before the AGENTS.md edit and passes after.

Validation: `make all`, then `make markdownlint` and `make nixie` (Markdown and
Mermaid gates for the docs changes).

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-10`.

For each work item, in order:

1. Write the failing test(s) named in the work item. Run the focused suite and
   confirm the expected failure:

       bun test tests/build-gate/review-evidence-artefact.test.ts

   Expect a failure that names the missing module/behaviour (Red).
2. Implement the minimal production change. Re-run the focused suite; expect
   pass (Green).
3. Refactor for clarity within the constraints; re-run the focused suite.
4. Run the full gate before committing:

       make all

   Expect build, `check-fmt`, `whitespace-hygiene`, lint, typecheck, and test
   to pass. For WI6 also run:

       make markdownlint
       make nixie

5. Sanity-check the end-to-end behaviour after WI3-WI5 exist (manual, from a
   temp dir is unnecessary — use the repo default path, which is git-ignored):

       # No artefact yet -> rejected
       bun run tests/build-gate/review-evidence-artefact-cli.ts
       echo "exit=$?"        # expect exit=1, "missing"
       # Record a verified report, then accept
       bun run tests/build-gate/review-evidence-cli.ts \
         --record=.review-evidence/report.txt \
         --scrutineer=available
       make review-evidence-artefact
       echo "exit=$?"        # expect exit=0, "present ... verified"

6. Commit each work item separately with a clear en-GB imperative subject
   (AGENTS.md "Committing"); gate every commit with `make all`.

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` (via `make all`) passes, including the new
  `review-evidence-artefact*` suites, the property round-trip, the CLI smoke
  tests, and the extended `makefile.test.ts` and
  `review-evidence-audit.test.ts`.
- Lint/typecheck: `make lint` and `make typecheck` pass with no new
  suppressions (AGENTS.md "Warnings and suppressions").
- Formatting: `make check-fmt` passes.
- Markdown: `make markdownlint` and `make nixie` pass after WI6.
- File size: `tests/build-gate/file-size.test.ts` passes (each new file < 400
  lines).

Acceptance (behaviour a human can verify), matching the roadmap success
criterion:

- Running `bun run tests/build-gate/review-evidence-artefact-cli.ts` with no
  `.review-evidence/report.txt` prints `Review evidence artefact: missing` and
  exits 1; the Makefile target fails non-zero for the same missing artefact.
- After
  `bun run tests/build-gate/review-evidence-cli.ts`
  `--record=.review-evidence/report.txt --scrutineer=available` writes the
  report, `make review-evidence-artefact` prints
  `Review evidence artefact: present` with `- recorded status: verified` and
  exits 0.
- A `.review-evidence/report.txt` containing arbitrary non-report text, or a
  recorded `usage-error`, is rejected with `Review evidence artefact: invalid`
  and exit 1.

Red-Green-Refactor evidence to record per work item as it lands:

- Red: focused `bun test <new spec>` failing for the intended reason.
- Green: same command passing after the minimal implementation.
- Refactor: `make all` passing after cleanup.

## Idempotence and recovery

- All steps are re-runnable. Re-running `make review-evidence` with `--record`
  overwrites the artefact deterministically; re-running the check is read-only.
- The recorded artefact lives under the git-ignored `.review-evidence/`
  directory, so repeated runs never dirty the working tree or produce review
  churn. Delete the directory to reset local state.
- If a work item's `make all` fails after 3 focused attempts, stop and escalate
  (Tolerances) rather than widening scope.

## Interfaces and dependencies

New modules under `tests/build-gate/` (no new external dependencies):

- `review-evidence-artefact.ts`

      export type RecordedStatus = "verified" | "failed" | "degraded";
      export type RecordedEvidenceResult =
        | { readonly outcome: "present"; readonly path: string; readonly status: RecordedStatus }
        | { readonly outcome: "missing"; readonly path: string }
        | { readonly outcome: "invalid"; readonly path: string; readonly reason: string }
        | { readonly outcome: "usage-error"; readonly message: string };
      export const DEFAULT_EVIDENCE_ARTEFACT_PATH = ".review-evidence/report.txt";
      export function parseRecordedStatus(content: string): RecordedStatus | undefined;
      export function classifyRecordedEvidence(input: {
        readonly path: string;
        readonly content: string | undefined;
      }): RecordedEvidenceResult;
      export function resolveEvidenceArtefactPath(input: {
        readonly flagValue?: string;
        readonly env: NodeJS.ProcessEnv;
      }): string;

- `review-evidence-artefact-report.ts`

      export function formatRecordedEvidenceResult(result: RecordedEvidenceResult): string;

- `review-evidence-artefact-cli.ts`

      export type ReviewEvidenceArtefactExitCode = 0 | 1 | 2;
      export type RunReviewEvidenceArtefactCliOptions = {
        readonly readFile?: (path: string) => string | undefined;
        readonly writeOut?: CliWriters["writeOut"];
        readonly writeErr?: CliWriters["writeErr"];
        readonly env?: NodeJS.ProcessEnv;
        readonly cwd?: string;
      };
      export function runReviewEvidenceArtefactCli(
        args?: readonly string[],
        options?: RunReviewEvidenceArtefactCliOptions,
      ): ReviewEvidenceArtefactExitCode;

Extended interface (additive only) in `review-evidence-cli.ts`:

      // RunReviewEvidenceCliOptions gains:
      readonly writeArtefact?: (path: string, content: string) => void;
      // New CLI flag --record=<path>; new env ODW_LINT_REVIEW_EVIDENCE_PATH;
      // both resolved through resolveEvidenceArtefactPath.

Reused, unchanged: `cli-support.ts` (`resolveCliWriters`, `emitCliReport`,
`CliWriters`), `review-evidence-report.ts` (`formatReviewEvidenceResult`),
`review-evidence.ts` (`ReviewEvidenceResult`), `git-support.ts`
(`createCapturedCliOutput` for tests).

## Addenda

- [x] 1.5.10.1. Add recorded-evidence report integrity checks.
  - Source: review:1.5.10.
  - Severity: low.
  - Scope: extend the recorded-evidence artefact classifier with lightweight
    structural validation so a truncated or corrupted report whose first
    `Review evidence: <status>` line survives no longer classifies as present.
  - Success: fixture or unit coverage proves partial reports fail closed while
    complete `verified`, `failed`, and `degraded` reports still classify as
    present recorded evidence.

## Revision note

GIST triage update: added addendum 1.5.10.1 for recorded-evidence report
integrity after the 1.5.10 review batch. Staleness and provenance remain
outside this completed task and are now tracked as their own roadmap task.
