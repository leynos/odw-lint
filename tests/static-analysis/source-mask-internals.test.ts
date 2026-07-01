/**
 * @file Internal source-mask helper tests.
 *
 * These tests pin scanner helper contracts without turning the helper modules
 * into public package exports.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile } from "../../src/static-analysis/source-file";
import { maskNonCodeSource } from "../../src/static-analysis/source-mask";
import { scanCommentRange } from "../../src/static-analysis/source-mask-comments";
import {
  blankMaskedRange,
  createMaskedRange,
  isLineTerminatorCharacter,
  isStringLikeDelimiter,
  scanEscapedDelimitedEnd,
} from "../../src/static-analysis/source-mask-delimiters";
import { scanQuotedStringRange } from "../../src/static-analysis/source-mask-strings";
import {
  nextTemplateIndex,
  scanTemplateRange,
} from "../../src/static-analysis/source-mask-templates";
import type {
  MaskedSource,
  SourceMaskKind,
  SourceMaskRange,
} from "../../src/static-analysis/source-mask-types";

const SOURCE_MASK_KINDS = [
  "comment",
  "string",
  "template",
  "regex",
] as const satisfies readonly SourceMaskKind[];

describe("source-mask internal types", () => {
  it("keeps source-mask data types compile-compatible with the facade contract", () => {
    const sourceFile = createOriginalSourceFile({
      filePath: "workflow.odw.js",
      sourceText: "export const meta = {};",
    });
    const range = {
      kind: SOURCE_MASK_KINDS[0],
      startIndex: 0,
      endIndex: 6,
    } satisfies SourceMaskRange;
    const typeCheckedMaskedSource = {
      sourceFile,
      maskedText: "       const meta = {};",
      ranges: [range],
    } satisfies MaskedSource;

    void typeCheckedMaskedSource;
  });
});

describe("source-mask delimiter helpers", () => {
  it("creates source-mask range descriptors", () => {
    expect(createMaskedRange("comment", 1, 9)).toEqual({
      kind: "comment",
      startIndex: 1,
      endIndex: 9,
    });
  });

  it("identifies JavaScript line terminator characters", () => {
    expect(["\n", "\r", "\u2028", "\u2029"].every(isLineTerminatorCharacter)).toBeTrue();
    expect([" ", "x", "`"].some(isLineTerminatorCharacter)).toBeFalse();
  });

  it("blanks masked ranges while preserving line terminators", () => {
    const sourceText = "a/*x\r\ny*/z";
    const characters = sourceText.split("");

    blankMaskedRange(characters, sourceText, createMaskedRange("comment", 1, 9));

    expect(characters.join("")).toBe("a   \r\n   z");
  });

  it("scans escaped delimiter endings and unterminated input", () => {
    expect(scanEscapedDelimitedEnd("'x'", 0, "'")).toBe(3);
    expect(scanEscapedDelimitedEnd("'\\''", 0, "'")).toBe(4);
    expect(scanEscapedDelimitedEnd("''", 0, "'")).toBe(2);
    expect(scanEscapedDelimitedEnd("'\\", 0, "'")).toBe(2);
    expect(scanEscapedDelimitedEnd("'open", 0, "'")).toBe(5);
    expect(scanEscapedDelimitedEnd('"\\""', 0, '"')).toBe(4);
    expect(scanEscapedDelimitedEnd('"open', 0, '"')).toBe(5);
    expect(scanEscapedDelimitedEnd("`\\``", 0, "`")).toBe(4);
    expect(scanEscapedDelimitedEnd("`open", 0, "`")).toBe(5);
  });

  it("identifies string-like template delimiters", () => {
    expect(["'", '"', "`"].every(isStringLikeDelimiter)).toBeTrue();
    expect(["/", "{", "x"].some(isStringLikeDelimiter)).toBeFalse();
  });
});

describe("source-mask comment scanner", () => {
  it("scans line and block comment ranges", () => {
    expect(scanCommentRange("// x\nnext", 0, "/", "/")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 5,
    });
    expect(scanCommentRange("// x\r\nnext", 0, "/", "/")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 6,
    });
    expect(scanCommentRange("/* x */ next", 0, "/", "*")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 7,
    });
    expect(scanCommentRange("/* open", 0, "/", "*")).toEqual({
      kind: "comment",
      startIndex: 0,
      endIndex: 7,
    });
  });
});

describe("source-mask quoted-string scanner", () => {
  it("scans quoted string ranges", () => {
    expect(scanQuotedStringRange("'x'", 0, "'")).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 3,
    });
    expect(scanQuotedStringRange('"x"', 0, '"')).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 3,
    });
    expect(scanQuotedStringRange("'\\''", 0, "'")).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 4,
    });
    expect(scanQuotedStringRange("'open", 0, "'")).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 5,
    });
  });

  it("ends unterminated quoted strings before following-line code", () => {
    expect(scanQuotedStringRange("'open\nconst next = 1;", 0, "'")).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 5,
    });
    expect(scanQuotedStringRange('"open\nconst next = 1;', 0, '"')).toEqual({
      kind: "string",
      startIndex: 0,
      endIndex: 5,
    });
  });
});

describe("source-mask template scanner", () => {
  it("tracks nested braces inside template expressions", () => {
    const sourceText = ["`value $", "{{ nested: { ok: true } }} tail`"].join("");

    expect(scanTemplateRange(sourceText, 0, "`")).toEqual({
      kind: "template",
      startIndex: 0,
      endIndex: sourceText.length,
    });
  });

  it("skips comments while tracking template expression braces", () => {
    const sourceText = ["`value $", "{/* } ` */ { ok: true }} tail`"].join("");

    expect(scanTemplateRange(sourceText, 0, "`")).toEqual({
      kind: "template",
      startIndex: 0,
      endIndex: sourceText.length,
    });
  });

  it("scans nested templates inside template expressions", () => {
    const sourceText = [
      "`value $",
      "{({ nested: { ok: true } }) + `inner $",
      "{value}`} tail`",
    ].join("");

    expect(scanTemplateRange(sourceText, 0, "`")).toEqual({
      kind: "template",
      startIndex: 0,
      endIndex: sourceText.length,
    });
  });

  it("skips regex literals while tracking template expression braces", () => {
    const sourceText = ["`value $", "{/}`/.test(value) ? `inner` : value} tail`"].join("");

    expect(scanTemplateRange(sourceText, 0, "`")).toEqual({
      kind: "template",
      startIndex: 0,
      endIndex: sourceText.length,
    });
  });

  it("skips keyword-led regex literals inside template expressions", () => {
    const sourceText = [
      "const x = `value $",
      "{(() => { return /}`/.test(input); })()} tail`; const y = 1;",
    ].join("");
    const templateStartIndex = sourceText.indexOf("`");
    const templateEndIndex = sourceText.indexOf("`; const y") + 1;

    expect(scanTemplateRange(sourceText, templateStartIndex, "`")).toEqual({
      kind: "template",
      startIndex: templateStartIndex,
      endIndex: templateEndIndex,
    });
    expect(
      maskNonCodeSource(
        createOriginalSourceFile({
          filePath: "workflow.odw.js",
          sourceText,
        }),
      ).maskedText.slice(templateEndIndex),
    ).toBe("; const y = 1;");
  });

  it("skips comments before keyword-led regex literals inside template expressions", () => {
    const sourceText = [
      "const x = `value $",
      "{(() => { return /* c */ /}`/.test(input); })()} tail`; const y = 1;",
    ].join("");
    const sourceFile = createOriginalSourceFile({
      filePath: "workflow.odw.js",
      sourceText,
    });

    expect(maskNonCodeSource(sourceFile)).toMatchSnapshot();
  });

  it("does not treat division as regex inside template expressions", () => {
    const sourceText = ["`value $", "{a / b} / $", "{c}`"].join("");

    expect(scanTemplateRange(sourceText, 0, "`")).toEqual({
      kind: "template",
      startIndex: 0,
      endIndex: sourceText.length,
    });
    expect(nextTemplateIndex(["$", "{a / b} /"].join(""), 4, 1)).toBeUndefined();
  });

  it("keeps leading class-close literals inside template regex expressions", () => {
    expect(nextTemplateIndex("/[]/}]/.test(value)", 0, 1)).toBe(7);
  });
});
