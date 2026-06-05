@AGENTS.md

# Git
Never add `Co-Authored-By` lines to commit messages.

## Commits during skills
Never run `git commit` (or otherwise commit) while executing any skill. Skills
must not create commits as part of their workflow. Only commit when the user
explicitly asks for a commit in a direct message — never as an automatic step
inside a skill.

When running any planning skill (`superpowers:writing-plans`,
`superpowers:brainstorming`, `superpowers:executing-plans`, and any other
plan/spec/execution skill), do not ask the user any questions about committing
and do not include commit steps, commit checkpoints, or commit questions in the
generated plan or its checklist.
