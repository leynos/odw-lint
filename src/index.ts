/**
 * @file Example module used by the repository template tests.
 */

/**
 * Builds a friendly greeting for a provided display name.
 *
 * @param name Display name to include in the greeting.
 * @returns Greeting text containing the provided name.
 */
export const greet = (name: string): string => {
  return `Hello, ${name}!`;
};
