# 0002. Workflow-body parser dialect scope

Status: Accepted
Date: 2026-07-03

## Context

`odw-lint` parses workflow bodies before a workflow runs so it can report
`odw/body-syntax` without executing user source. The parser path normalizes the
workflow body and passes it to SWC with `syntax: "ecmascript"` and `jsx: false`.
That configuration accepts ECMAScript source, not TypeScript-only syntax.

The adjacent ODW loader compiles workflow bodies through a JavaScript function
constructor path. A lint diagnostic that accepts TypeScript-only workflow-body
syntax would therefore diverge from the runtime loader unless the divergence
was explicit and tested. The design contract requires such loader-parity
differences to be intentional and documented.

## Decision

Workflow bodies are parsed as ECMAScript-only source. TypeScript-only syntax
that the ECMAScript grammar cannot express is rejected with `odw/body-syntax`.
That rejected set includes colon type annotations on variables or parameters,
such as `const value: number` and `function typed(value: number)`, plus
`interface`, `enum`, `as`, and `satisfies`.

Generic call syntax such as `identity<number>(1)` is not reported by
`odw/body-syntax`. Under the ECMAScript grammar, `<` and `>` are relational
operators, so the parser accepts that source as the comparison expression
`(identity < number) > (1)`. This is an accepted boundary case, not a
TypeScript-only syntax error.

## Consequences

- `odw/body-syntax` documents and tests TypeScript-only syntax as an
  ECMAScript dialect error rather than an accidental parser limitation.
- Future `@swc/core` upgrades must re-observe the TypeScript-in-body outcome
  before they are accepted. The developers guide keeps the SWC upgrade
  checklist and should reference this dialect decision.
- Adding TypeScript workflow-body support would be a public behaviour change. It
  would need a new design decision, loader-parity analysis, documentation
  updates, and tests that define the new accepted and rejected syntax boundary.
- ADR 0003 records the separate body-syntax span-narrowing disposition: the
  current SWC parser keeps `odw/body-syntax` on the whole workflow body, with
  token-level narrowing quarantined until a stable structured parser offset is
  available.

## Rejected alternative

- Parsing workflow bodies with SWC's TypeScript dialect would accept source that
  the ODW loader cannot execute as JavaScript. That would make `odw-lint` less
  useful as a pre-runtime checker and would violate the documented
  static-analysis boundary unless ODW first gained a matching TypeScript
  compilation path.
