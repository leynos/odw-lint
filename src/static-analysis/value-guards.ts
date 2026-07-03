/**
 * @file Shared value guards for static-analysis parser boundaries.
 *
 * These helpers keep parser-facing unknown-value checks consistent without
 * accepting broader object shapes than each caller already reviews.
 */

export type UnknownRecord = {
  readonly [key: string]: unknown;
};

/**
 * Checks whether an unknown value can be inspected as an object record.
 *
 * @param value - Unknown value from a parser or caller boundary.
 * @returns Whether `value` is a non-null object record.
 */
export const isUnknownRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * Checks whether an unknown value is a finite number.
 *
 * @param value - Unknown value from a parser or caller boundary.
 * @returns Whether `value` is a finite JavaScript number.
 */
export const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};
