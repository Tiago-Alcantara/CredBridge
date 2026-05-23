<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:skill-selection-rules -->
# Skill Selection

Before answering or changing files, read the user's request and check whether any
available skill applies. If a skill is relevant, open its `SKILL.md` and follow
only the parts needed for the task.

For requests to create or update product specs, implementation specs, execution
plans, or task breakdowns, first look for relevant `superpowers:*` skills in the
active environment. Prefer those skills when available. If no Superpowers skill
is available, follow the repository convention in `docs/superpowers/`:

- product/design specs live in `docs/superpowers/specs/`
- implementation plans live in `docs/superpowers/plans/`
- plans should include a reference spec when one exists
- implementation plans should use checkbox steps (`- [ ]`) so agents can track
  progress task by task
- new plans should keep the existing header style that tells agentic workers
  which Superpowers execution skill to use when implementing the plan

If no skill clearly fits, say that briefly and proceed with the best local repo
pattern.
<!-- END:skill-selection-rules -->

<!-- BEGIN:coding-style-rules -->
# Coding Style

Before writing or changing code, read
`documentacao/Preference - Coding Style.md` and make sure the implementation
matches it. After editing code, review the changed files against that preference
before considering the task complete.

In particular, favor explicit, readable, linear code; use descriptive names;
avoid unnecessary dependencies; avoid casual `any`; and preserve stronger local
project conventions when they exist.
<!-- END:coding-style-rules -->
