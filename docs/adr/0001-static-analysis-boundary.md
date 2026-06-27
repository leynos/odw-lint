# 0001. Static-analysis boundary

Status: Proposed
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

`odw-lint` must own an explicitly static analysis boundary before
implementation starts. The first implementation may choose one of two
architectural paths, but it must record the chosen path in this ADR before any
runtime-parity code lands:

- **Shared static package/API.** ODW exposes a safe static-analysis module that
  never evaluates workflow source. `odw-lint` imports only that module and its
  types.
- **Vendored static implementation.** `odw-lint` owns a copied static
  implementation of the envelope scanner, pure metadata parser, dual-compat
  scanner, and span mapper, with mandatory parity tests against trusted ODW
  fixtures.

The following imports are forbidden in production `odw-lint` code unless ODW
first refactors them into a documented non-executing static package:

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
- If the project chooses vendoring, every mirrored ODW behaviour needs a
  fixture that explains the intended parity and its drift risk.
- If the project chooses a shared ODW static package, ODW must treat that
  package as a public compatibility surface.

## Open points

- Decide whether the shared static API belongs in ODW, a separate package, or
  `odw-lint` with ODW consuming it later.
- Decide whether ODW should eventually replace its executable metadata parsing
  with the same static metadata contract, or deliberately keep runtime leniency
  separate from lint strictness.
