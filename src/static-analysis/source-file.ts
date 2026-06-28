/**
 * @file Original workflow source-file records for static analysis.
 *
 * The helpers in this module describe the source text exactly as it was read,
 * before parser normalization or future diagnostic mapping. Byte offsets are
 * UTF-8 offsets into that original text.
 */

import { recordSourceIndexes } from "./source-indexes";
import { scanOriginalSource } from "./source-scan";
import { ORIGINAL_SOURCE_FILE_BRAND, type OriginalSourceFile, type WorkflowSource } from "./types";

export { positionAtOffset, spanFromOffsets } from "./source-position";
export { sliceSourceSpan, snippetForSpan } from "./source-snippet";

/**
 * Creates an immutable source-file record from original workflow source text.
 *
 * @param source - Original workflow source text and its diagnostic file path.
 * @returns Source-file metadata with UTF-8 byte length and display lines.
 */
export const createOriginalSourceFile = (source: WorkflowSource): OriginalSourceFile => {
  const scan = scanOriginalSource(source.sourceText);
  const sourceFile = {
    filePath: source.filePath,
    sourceText: source.sourceText,
    byteLength: scan.byteLength,
    lines: scan.lines,
  } as OriginalSourceFile;
  Object.defineProperty(sourceFile, ORIGINAL_SOURCE_FILE_BRAND, {
    value: true,
  });
  Object.freeze(sourceFile);

  recordSourceIndexes(sourceFile, scan);

  return sourceFile;
};
