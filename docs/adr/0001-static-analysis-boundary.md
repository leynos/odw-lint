# 0001. Static-analysis boundary

Status: Accepted
Date: 2026-06-28

## Context

`odw-lint` checks workflow source before any workflow runs. That makes the
static-analysis boundary a security boundary, not an implementation detail.
The adjacent ODW runtime currently evaluates sliced metadata with
`new Function` in its loader, and the injected `validate(source)` primitive
calls that executable loader path. Those APIs are not safe for host-side lint
of untrusted pull-request input.

ODW also does not currently export a safe static workflow-analysis API from its
public package entry point. It exports workflow metadata types, but not
`loadWorkflowScript`, `checkMeta`, `scanDualCompat`, the source masker, or a
static envelope scanner.

## Decision

`odw-lint` owns its static-analysis implementation. The first implementation
will vendor the ODW workflow envelope scanner, pure metadata parser,
dual-compat scanner, span mapper, and related static semantics into
`odw-lint`, then keep them aligned with mandatory parity tests against trusted
ODW fixtures.

This is an ownership decision. `odw-lint` does not depend on ODW maintainers
publishing a safe static API, changing ODW's package exports, or accepting a
runtime refactor before `odw-lint` can implement its core checker.

The following imports are forbidden in production `odw-lint` code:

- `loadWorkflowScript`
- `createPrimitives`
- `validate(source)` through any primitive factory
- any ODW module that evaluates metadata, compiles workflow bodies, starts
  runs, or dispatches agents

Tests may import executable ODW runtime APIs only inside narrowly scoped,
trusted fixture parity tests. They must never feed those APIs untrusted source
or hostile metadata fixtures.

## Consequences

- The first dialect slice must include a regression test that proves
  `odw-lint` does not import executable loader or primitive paths in
  production code.
- The first dialect slice must include a hostile metadata fixture whose source
  would execute if evaluated. The expected result is a diagnostic, with no side
  effect.
- Loader parity moves from an adoption hardening task to a release-blocking
  property of the first useful checker.
- Every mirrored ODW behaviour needs a fixture that explains the intended
  parity and its drift risk.
- Future ODW integration should consume `odw-lint`'s static API where possible,
  not require `odw-lint` to switch to ODW's private runtime helpers.
- A future shared static package remains possible, but it must be extracted
  from the proven `odw-lint` static implementation or matched by contract
  tests. It is not a v1 dependency.

## Rejected alternative

A shared static ODW API would reduce code ownership inside `odw-lint`, but the
project does not control ODW's export surface or release cadence. Making that
API a prerequisite would block the checker on another project and leave the
trust boundary unresolved during implementation.

## Open point

- Decide whether ODW should eventually consume `odw-lint`'s static metadata
  contract, or deliberately keep runtime leniency separate from lint strictness.
