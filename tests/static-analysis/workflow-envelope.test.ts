/**
 * @file Workflow envelope scanner tests.
 */

import { describe, expect, it } from "bun:test";
import type { Diagnostic, SourceSpan } from "odw-lint";
import { createOriginalSourceFile, makeRuleId } from "odw-lint";
import { scanWorkflowEnvelope } from "../../src/static-analysis/workflow-envelope";
import { expectScannedEnvelope, spanTextFor } from "./workflow-envelope-support";

const WORKFLOW_PATH = "workflows/example.js";
const NO_IMPORT_EXPORT_DIAGNOSTIC = {
  message: "Workflow body must not add top-level imports or exports.",
  rule: makeRuleId("odw/no-import-export"),
  severity: "error",
} as const;

/** Builds one original source fixture for scanner tests. */
const sourceFile = (sourceText: string) =>
  createOriginalSourceFile({ filePath: WORKFLOW_PATH, sourceText });

/** Returns the text covered by a span in one source string. */
const spanText = (sourceText: string, span: SourceSpan): string => {
  return spanTextFor(sourceFile(sourceText), span);
};

/** Returns diagnostics for one source fixture. */
const resultDiagnostics = (sourceText: string) => {
  return scanWorkflowEnvelope(sourceFile(sourceText)).diagnostics;
};

/** Projects diagnostics to the fields that pin unsupported-syntax behaviour. */
const diagnosticSummaries = (sourceText: string, diagnostics: readonly Diagnostic[]) => {
  return diagnostics.map((diagnostic) => ({
    message: diagnostic.message,
    rule: diagnostic.rule,
    severity: diagnostic.severity,
    spanText: spanText(sourceText, diagnostic.span),
  }));
};

describe("workflow envelope metadata declaration scan", () => {
  it("emits a missing metadata diagnostic at the start of source", () => {
    const sourceText = "await agent({ prompt: 'work' });";
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(result.status).toBe("missing-meta");
    expect(result.envelope).toBeUndefined();
    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        message: "Workflow metadata must declare export const meta.",
        rule: makeRuleId("odw/meta-required"),
        severity: "error",
        spanText: "",
      },
    ]);
  });

  it("records metadata declaration, export keyword, and assignment spans", () => {
    const sourceText = 'export const meta = { name: "example" };\nreturn meta.name;';
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(spanText(sourceText, envelope.metaDeclarationSpan)).toBe("export const meta =");
    expect(spanText(sourceText, envelope.metaExportKeywordSpan)).toBe("export");
    expect(spanText(sourceText, envelope.metaAssignmentOperatorSpan)).toBe("=");
    expect(envelope.metaDeclarationSpan).toEqual({
      start: { offset: 0, line: 1, column: 1 },
      end: { offset: 19, line: 1, column: 20 },
    });
  });

  it("uses UTF-8 byte offsets when Unicode appears before metadata", () => {
    const prefix = "// café 雪 🧪\n";
    const sourceText = `${prefix}export const meta = { name: "unicode" };`;
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));
    const expectedOffset = Buffer.byteLength(prefix, "utf8");

    expect(envelope.metaExportKeywordSpan.start.offset).toBe(expectedOffset);
    expect(spanText(sourceText, envelope.metaDeclarationSpan)).toBe("export const meta =");
  });

  it("ignores decoy metadata declarations in inert source regions", () => {
    const sourceText = [
      "// export const meta = { name: 'comment' };",
      "/* export const meta = { name: 'block' }; */",
      "const stringDecoy = \"export const meta = { name: 'string' };\";",
      "const templateDecoy = `export const meta = { name: 'template' };`;",
      "const regexDecoy = /export const meta = \\{ name: 'regex' \\};/;",
      'export const meta = { name: "real" };',
    ].join("\n");
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(spanText(sourceText, envelope.metaDeclarationSpan)).toBe("export const meta =");
    expect(envelope.metaDeclarationSpan.start.line).toBe(6);
  });

  it("ignores nested metadata declarations outside the workflow top level", () => {
    const sourceText = [
      "namespace nested {",
      '  export const meta = { name: "nested" };',
      "}",
      'export const meta = { name: "real" };',
    ].join("\n");
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(spanText(sourceText, envelope.metaDeclarationSpan)).toBe("export const meta =");
    expect(envelope.metaDeclarationSpan.start.line).toBe(4);
  });

  it("freezes result arrays and envelope facts at runtime", () => {
    const result = scanWorkflowEnvelope(sourceFile('export const meta = { name: "frozen" };'));
    const envelope = expectScannedEnvelope(result);

    expect(Object.isFrozen(result)).toBeTrue();
    expect(Object.isFrozen(result.diagnostics)).toBeTrue();
    expect(Object.isFrozen(envelope)).toBeTrue();
    expect(Object.isFrozen(envelope.metaValue)).toBeTrue();
    expect(Object.isFrozen(envelope.unsupportedDeclarations)).toBeTrue();
  });
});

describe("workflow envelope metadata value states", () => {
  it("records object metadata spans with nested braces and arrays", () => {
    const sourceText =
      'export const meta = { name: "nested", nested: { values: [{ ok: true }] } };\nreturn null;';
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(envelope.metaValue.kind).toBe("object");
    if (envelope.metaValue.kind === "object") {
      expect(spanText(sourceText, envelope.metaValue.span)).toBe(
        '{ name: "nested", nested: { values: [{ ok: true }] } }',
      );
      expect(spanText(sourceText, envelope.metaValue.openBraceSpan)).toBe("{");
      expect(spanText(sourceText, envelope.metaValue.closeBraceSpan)).toBe("}");
    }
  });

  it("ignores comments and strings while matching metadata braces", () => {
    const sourceText = [
      "export const meta = {",
      '  name: "brace } in string",',
      "  description: 'brace { in string',",
      "  // } in comment",
      "};",
    ].join("\n");
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(envelope.metaValue.kind).toBe("object");
    expect(envelope.bodySpan.start.line).toBe(5);
  });

  it("records computed metadata as a non-object expression", () => {
    const sourceText = "export const meta = makeMeta();\nif (ready) { await agent({}); }";
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(envelope.metaValue.kind).toBe("non-object-expression");
    if (envelope.metaValue.kind === "non-object-expression") {
      expect(spanText(sourceText, envelope.metaValue.expressionStartSpan)).toBe("m");
      expect(spanText(sourceText, envelope.metaValue.expressionSpan)).toBe("makeMeta()");
    }
  });

  it("records unterminated object metadata without executing source", () => {
    const sourceText = 'export const meta = { name: "open";';
    const result = scanWorkflowEnvelope(sourceFile(sourceText));
    const envelope = expectScannedEnvelope(result);

    expect(envelope.metaValue.kind).toBe("unterminated-object");
    if (envelope.metaValue.kind === "unterminated-object") {
      expect(spanText(sourceText, envelope.metaValue.openBraceSpan)).toBe("{");
      expect(spanText(sourceText, envelope.metaValue.span)).toBe('{ name: "open";');
    }
    expect(result.diagnostics).toEqual([]);
  });

  it("records an empty declaration tail as missing value", () => {
    const sourceText = "export const meta =   ";
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(envelope.metaValue.kind).toBe("missing-value");
    if (envelope.metaValue.kind === "missing-value") {
      expect(envelope.metaValue.span.start.offset).toBe(Buffer.byteLength(sourceText, "utf8"));
    }
    expect(resultDiagnostics(sourceText)).toEqual([]);
  });

  it("records a bare semicolon after assignment as missing value", () => {
    const sourceText = "export const meta =;";
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(envelope.metaValue.kind).toBe("missing-value");
    if (envelope.metaValue.kind === "missing-value") {
      expect(envelope.metaValue.span.start.offset).toBe("export const meta =".length);
    }
    expect(resultDiagnostics(sourceText)).toEqual([]);
  });

  it("uses UTF-8 byte offsets for missing-value body spans after Unicode", () => {
    const prefix = "// café 雪 🧪\n";
    const sourceText = `${prefix}export const meta =`;
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));
    const expectedOffset = Buffer.byteLength(sourceText, "utf8");

    expect(envelope.metaValue.kind).toBe("missing-value");
    expect(envelope.bodySpan.start.offset).toBe(expectedOffset);
  });

  it("starts the body after the complete metadata statement", () => {
    const sourceText = 'export const meta = { name: "body" };\nawait agent({});';
    const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile(sourceText)));

    expect(spanText(sourceText, envelope.bodySpan)).toBe("\nawait agent({});");
  });
});

describe("workflow envelope unsupported import and export scan", () => {
  it("reports a top-level static import before metadata", () => {
    const sourceText = 'import { helper } from "./helper.js";\nexport const meta = {};';
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'import { helper } from "./helper.js";',
      },
    ]);
  });

  it("reports an extra top-level export after metadata", () => {
    const sourceText = 'export const meta = {};\nexport const helper = "unsupported";';
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'export const helper = "unsupported";',
      },
    ]);
  });

  it("reports an extra export after an automatic semicolon insertion boundary", () => {
    const sourceText = [
      "export const meta = {}",
      "const value = 1",
      "export const helper = value;",
    ].join("\n");
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: "export const helper = value;",
      },
    ]);
  });

  it("reports a top-level dynamic import expression", () => {
    const sourceText = 'export const meta = {};\nconst helper = await import("./helper.js");';
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'import("./helper.js");',
      },
    ]);
  });

  it("reports an extra export after a same-line closing brace", () => {
    const sourceText =
      'export const meta = {};\nif (ready) {} export const helper = "unsupported";';
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'export const helper = "unsupported";',
      },
    ]);
  });

  it("reports imports after unicode line separators", () => {
    const sourceText = 'export const meta = {};\u2028import x from "./x.js";';
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'import x from "./x.js";',
      },
    ]);
  });

  it("does not report import or export prefixes in identifiers", () => {
    const sourceText = [
      "export const meta = {};",
      "const import$ = 1;",
      "const exporté = 2;",
      "const import𐐀 = 3;",
      'const helper = await import("./helper.js");',
    ].join("\n");
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'import("./helper.js");',
      },
    ]);
  });

  it("uses UTF-8 byte offsets for unsupported declarations after Unicode", () => {
    const prefix = "// café 雪 🧪\n";
    const sourceText = `${prefix}import x from "./x.js";\nexport const meta = {};`;
    const [diagnostic] = scanWorkflowEnvelope(sourceFile(sourceText)).diagnostics;

    expect(diagnostic?.span.start.offset).toBe(Buffer.byteLength(prefix, "utf8"));
    expect(diagnostic && spanText(sourceText, diagnostic.span)).toBe('import x from "./x.js";');
  });

  it("does not report nested import tokens inside function bodies", () => {
    const sourceText = [
      "export const meta = {};",
      "async function load() {",
      "  return import('./helper.js');",
      "}",
    ].join("\n");
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(result.diagnostics).toEqual([]);
  });

  it("does not report import or export tokens hidden in inert regions", () => {
    const sourceText = [
      "export const meta = {};",
      "// export const ignored = true;",
      "const stringDecoy = 'import x from y';",
      "const templateDecoy = `export const ignored = true;`; ",
      "const regexDecoy = /export\\s+const/;",
    ].join("\n");
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(result.diagnostics).toEqual([]);
  });

  it("does not report import or export property access at top level", () => {
    const sourceText = [
      "export const meta = {};",
      "import.meta.url;",
      "const moduleUrl = import.meta.url;",
      "const exportedValue = workflow.export.value;",
    ].join("\n");
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(result.diagnostics).toEqual([]);
  });

  it("returns multiple unsupported declarations in source order", () => {
    const sourceText = [
      'import a from "./a.js";',
      'export const meta = { name: "ordered" };',
      'export const b = "b";',
    ].join("\n");
    const result = scanWorkflowEnvelope(sourceFile(sourceText));

    expect(diagnosticSummaries(sourceText, result.diagnostics)).toEqual([
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'import a from "./a.js";',
      },
      {
        ...NO_IMPORT_EXPORT_DIAGNOSTIC,
        spanText: 'export const b = "b";',
      },
    ]);
  });
});
