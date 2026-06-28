/**
 * @file Passive masking fixture with decoy workflow syntax inside comments.
 */

export const meta = {
  name: "masking-comment-decoy",
  description: "Fixture proving comment decoys are inert.",
};

// export const meta = { name: "line-comment-decoy" };
// import { agent } from "odw";
// export default { unmatched: "line-comment" } } }

/*
 * export const meta = { name: "block-comment-decoy" };
 * import "fake-workflow-runtime";
 * export const body = { braceLike: "{{{ }}}" };
 */
const commentDecoyMarker = "comment-decoy-source";

await Promise.resolve(commentDecoyMarker);
