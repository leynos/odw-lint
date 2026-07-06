/**
 * @file Shared conversion for unknown thrown values at CLI boundaries.
 */

/**
 * Convert unexpected thrown values to stable user-visible text.
 *
 * @param error Thrown value captured at a command boundary.
 * @returns Message text for `Error` values, or JavaScript stringification.
 */
export const messageForThrownValue = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
