/**
 * @file Private source-index storage for original source-file records.
 *
 * Factory-created `OriginalSourceFile` values keep lookup tables in this
 * module so callers cannot forge structural records that pass validation.
 */

import type { SourceIndexes } from "./source-scan";
import { type OriginalSourceFile, SourceOffsetError } from "./types";

const SOURCE_INDEXES = new WeakMap<OriginalSourceFile, SourceIndexes>();

/**
 * Records private lookup tables for one factory-created source file.
 *
 * @param file - Source-file record created by `createOriginalSourceFile`.
 * @param indexes - Scan indexes derived from the same source text.
 */
export const recordSourceIndexes = (file: OriginalSourceFile, indexes: SourceIndexes): void => {
  SOURCE_INDEXES.set(file, indexes);
};

/**
 * Returns private lookup tables for source records created by the factory.
 *
 * @param file - Source-file record to inspect.
 * @returns The private indexes attached by `createOriginalSourceFile`.
 * @throws SourceOffsetError when the source file was structurally forged.
 */
export const sourceIndexes = (file: OriginalSourceFile): SourceIndexes => {
  const indexes = SOURCE_INDEXES.get(file);
  if (indexes === undefined) {
    throw new SourceOffsetError(`${file.filePath} was not created by createOriginalSourceFile.`);
  }

  return indexes;
};

/**
 * Looks up the UTF-16 string index for a valid source byte offset.
 *
 * @param file - Original source-file record.
 * @param offset - Valid UTF-8 byte offset.
 * @returns The corresponding UTF-16 string index.
 * @throws SourceOffsetError when the offset is not a valid source position.
 */
export const textIndexAtOffset = (file: OriginalSourceFile, offset: number): number => {
  const index = sourceIndexes(file).textIndexes.get(offset);
  if (index === undefined) {
    throw new SourceOffsetError(`Offset ${offset} is not a valid source position.`);
  }

  return index;
};
