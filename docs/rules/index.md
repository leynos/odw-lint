# Rule reference

This reference lists every rule reserved by the typed catalogue. Released
rules may be emitted by the checker; planned rules document reserved behaviour
that is not emitted yet.

| Rule                                                                | Category               | Default severity | Release status |
| ------------------------------------------------------------------- | ---------------------- | ---------------- | -------------- |
| [`odw/meta-required`](meta-required.md)                             | `dialect`              | `error`          | `released`     |
| [`odw/meta-object`](meta-object.md)                                 | `dialect`              | `error`          | `released`     |
| [`odw/meta-statically-unprovable`](meta-statically-unprovable.md)   | `dialect`              | `warning`        | `released`     |
| [`odw/meta-name`](meta-name.md)                                     | `dialect`              | `error`          | `released`     |
| [`odw/meta-description`](meta-description.md)                       | `dialect`              | `error`          | `released`     |
| [`odw/no-import-export`](no-import-export.md)                       | `dialect`              | `error`          | `released`     |
| [`odw/body-syntax`](body-syntax.md)                                 | `dialect`              | `error`          | `released`     |
| [`odw/claude-pure-meta`](claude-pure-meta.md)                       | `claude-compatibility` | `warning`        | `released`     |
| [`odw/no-date-now`](no-date-now.md)                                 | `claude-compatibility` | `warning`        | `released`     |
| [`odw/no-math-random`](no-math-random.md)                           | `claude-compatibility` | `warning`        | `released`     |
| [`odw/no-argless-new-date`](no-argless-new-date.md)                 | `claude-compatibility` | `warning`        | `released`     |
| [`odw/no-odw-only-validate`](no-odw-only-validate.md)               | `claude-compatibility` | `info`           | `released`     |
| [`odw/bounded-loop`](bounded-loop.md)                               | `orchestration-risk`   | `warning`        | `planned`      |
| [`odw/bounded-fanout`](bounded-fanout.md)                           | `orchestration-risk`   | `warning`        | `planned`      |
| [`odw/no-promise-race`](no-promise-race.md)                         | `orchestration-risk`   | `warning`        | `planned`      |
| [`odw/schema-for-structured-agent`](schema-for-structured-agent.md) | `orchestration-risk`   | `info`           | `planned`      |
| [`odw/worktree-isolation-note`](worktree-isolation-note.md)         | `orchestration-risk`   | `info`           | `planned`      |
