# `odw/worktree-isolation-note`

| Field             | Value                         |
| ----------------- | ----------------------------- |
| Rule ID           | `odw/worktree-isolation-note` |
| Category          | `orchestration-risk`          |
| Default severity  | `info`                        |
| Configuration key | `odw/worktree-isolation-note` |
| Release status    | `planned`                     |

This planned rule will report `isolation: "worktree"` when the prompt implies
persistent git state. Worktree isolation changes where files and repository
state live during a run.

The current checker does not emit this rule yet. When it is released, users
will normally fix findings by documenting the persistence expectation or by
choosing an isolation mode that matches the workflow.
