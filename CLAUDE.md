# Model Monitoring for Claude Code

Read README.md and docs/metrics.md before interpreting a result. This is a trusted-operator desk for numerical forecast monitoring, not an inference service. Use fictional demo data until the business has agreed its source, access and retention policy.

## Working rules

Run the CLI before answering. Never invent observations, outcomes, thresholds, owners or review dates. Resolve ambiguous names by listing candidates. Keep unknown outcomes unknown. Run the import dry run and reconcile counts before loading. Evidence is append-only. Corrections need a new snapshot ID and a new evaluation. Actor strings are attribution, not authentication.

Nothing here sends messages, changes deployed models or executes payments. Do not add those capabilities during routine monitoring. Record reviews and draft to drafts. Personal source data and exports stay out of git. Use .claude/commands from Claude Code, Codex, OpenCode or Cursor.

## Routing

| Request | Recipe |
|---|---|
| models | /models |
| model | /model |
| datasets | /datasets |
| observations | /observations |
| queue | /queue |
| quality | /quality |
| compliance | /compliance |
| actions | /actions |
| history | /history |
| imports | /imports |
| drift | /drift |
| performance | /performance |
| segments | /segments |
| evaluate | /evaluate |
| evaluations | /evaluations |
| add model | /add-model |
| import | /import |
| add action | /add-action |
| close action | /close-action |
| log | /log |
| review | /review |
| draft review | /draft-review |
| export | /export |
| attention | /attention |
| weekly review | /weekly-review |
| customise | /customise |
| new view | /new-view |
| view | /view |
| documents | /documents |

## Records and validation

One CLI: npm run monitor -- help. Database schema: supabase/migrations. Migrate with npm run migrate. Local PGlite lives under .data/db; DATABASE_URL selects PostgreSQL. A shared deployment needs real identities, least privilege, tested backups and a retention process. Native database backups are separate from JSON exports. Tests isolate a temporary database; TEST_DATABASE_URL must be disposable and empty. Run npm test and npm run demo after code changes.

Built and optionally run through Omni by Enterprise DNA.
