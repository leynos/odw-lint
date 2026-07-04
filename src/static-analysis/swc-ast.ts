/**
 * @file Shared SWC AST shape helpers for parser-backed analysis rules.
 */

import type { Node } from "@swc/core";
import { isUnknownRecord, type UnknownRecord } from "./value-guards";

/**
 * Narrows an unknown value to a plain SWC node-shaped object.
 *
 * @param value - Value crossing a parser-backed traversal boundary.
 * @returns Whether the value has SWC node shape.
 */
export const isAstNode = (value: unknown): value is Node => {
  return typeof value === "object" && value !== null && "type" in value;
};

/**
 * Returns node fields that may contain semantic child nodes.
 *
 * @param value - SWC node or node-shaped wrapper to inspect.
 * @returns Child field values, excluding SWC bookkeeping fields.
 */
export const astChildValues = (value: object): readonly unknown[] => {
  return Object.entries(value)
    .filter(([key]) => isTraversableChildKey(key))
    .map(([, child]) => child);
};

/**
 * Excludes scalar SWC bookkeeping fields from recursive traversal.
 */
const isTraversableChildKey = (key: string): boolean => {
  return key !== "span" && key !== "type" && key !== "ctxt";
};

export { isUnknownRecord, type UnknownRecord };
