# Contributing

## Commit conventions

Every commit follows [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`, imperative mood, lower case after the colon, no trailing period, subject under 72 characters. Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `build`, `ci`.

**One commit touches one concern** — application code (`classroom_project/`), documentation (`docs/`, `README.md`), or chore/tooling, never mixed together. This isn't just style: GitHub's file listing shows, beside each path, the message of whatever commit most recently touched it. A commit that mixes a docs rewrite with an application fix leaves the application folder labelled with a documentation message, and vice versa — one concern per commit keeps that listing honest.

The same rule applies at the pull-request level when PRs are merged via squash-merge, since the PR title becomes the resulting commit message: one concern per PR, PR titles follow Conventional Commits, a docs-only change goes in its own PR rather than riding along with a code change.

## Setup

Run once per clone, at the repo root:

```bash
npm install
```

This installs the repo's git hooks and commit template via the `prepare` script:
- `.githooks/pre-commit` rejects a commit that stages changes spanning more than one concern (app / docs / chore).
- `.githooks/commit-msg` rejects a subject line that doesn't follow the format above.
- `.gitmessage` becomes your default commit message template.

If you'd rather wire it up by hand instead of `npm install`:

```bash
git config core.hooksPath .githooks
git config commit.template .gitmessage
```

A genuine cross-cutting change (a refactor that legitimately updates its own docs in the same commit) can bypass the scope check deliberately:

```bash
SKIP_COMMIT_SCOPE_CHECK=1 git commit -m "..."
```
