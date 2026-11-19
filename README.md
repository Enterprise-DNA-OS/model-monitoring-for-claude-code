# Model Monitoring for Claude Code

Know when your forecasts stop matching the business. Keep numerical predictions, observed results, comparison windows and follow-ups in your own database. A focused alternative to the weekly monitoring work around Fiddler. MIT licence. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free. Install the database and commands below. | Your metrics, source mapping, review rules and screens. | Installed and operated through Omni by Enterprise DNA. Setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=fiddler) | [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=fiddler) |

Fiddler's vendor-run [SageMaker marketplace listing](https://aws.amazon.com/marketplace/pp/prodview-caia5ckldtyhs) shows US$2,500 a month for five models. Twelve monthly payments total US$30,000. This is a published package, not a confirmed customer invoice, annual-contract quote or the cost of every Fiddler plan. [Research and scope](docs/research.md).

## Quick start

Node 20 or newer. No vendor account, credentials or hosted database needed for the demo.

```bash
npm install
npm run demo
npm run monitor -- drift --baseline=reference --production=this-week
npm run monitor -- performance --baseline=reference --production=this-week
npm run monitor -- evaluate --baseline=reference --production=this-week --actor="Demo operator"
npm run view
npm run docs
```

The fictional Harbour Demand example has 20 reference observations, 20 production predictions and 16 observed outcomes. Its fixed-bin distribution distance is 0.8; mean absolute error is 20 cartons. Four unknown outcomes never become zero errors. /segments shows which supplied business regions changed. All sample data is fictional and dates are relative to the seed day.

PGlite persists locally in .data/db. Set DATABASE_URL for PostgreSQL and run npm run migrate. Do not seed a live database. The CLI is for trusted operators; team deployment requires identity, least privilege, backups and retention controls. Public database access is revoked. Typed actor names do not authenticate people, and a database owner can bypass application controls.

## The working week

1. /quality reconciles loaded observations and missing outcomes.
2. /drift compares a recorded feature distribution against a chosen reference.
3. /performance measures forecast error on observed outcomes.
4. /segments checks supplied business groups, with small samples flagged.
5. /attention finds overdue work and unreviewed production windows.
6. /weekly-review prepares the private review pack.

29 recipes in .claude/commands, excluding its README. The one CLI has 24 verbs including help. Run npm run monitor -- help for flags. Reads return aligned text or --json. Names are case-insensitive; model names include the version. Unique UUID prefixes work. Ambiguous matches list candidates and exit 1.

## Bring Fiddler observations across

Fiddler's documented Model.download_data exports production or pre-production observations to CSV. Its columns belong to your model, so the manifest explicitly maps them. Export the reference and production windows, include stable event identifiers and reconcile counts before importing. The default vendor download limit can truncate an export: see the switching guide.

```bash
npm run monitor -- import fiddler --model="Harbour Demand v1" --manifest=examples/manifest.json --actor="Demo operator" --dry-run
npm run monitor -- import fiddler --model="Harbour Demand v1" --manifest=examples/manifest.json --actor="Demo operator"
```

The example files are fictional shapes, not captured customer exports. A bundle loads atomically. Exact replays skip; changed evidence with an existing snapshot ID is rejected. Source systems are separated by the model's source and external ID. The manifest's count is your declared reconciliation, not proof the vendor export is complete. [Switching guide](docs/replace-fiddler.md).

## What this version measures

Each registered model version holds one numerical feature, one numerical prediction, one observed outcome and a business segment. It calculates fixed-bin total variation distance, missing-feature counts, outcome coverage, mean absolute error, root mean square error and signed forecast bias. The model definition and saved evidence cannot be edited through the CLI. A changed feature, unit, limit or boundary is a new version. [Metric definitions and limits](docs/metrics.md).

This is a numerical regression review desk. It does not run inference, retrain models, implement live guardrails, explain individual predictions, calculate classification fairness, or process text traces. It does not establish causation or certify a model fit for deployment. It is distinct from an approval register and from testing conversational answers. Enterprise DNA scopes additional features around the work the business needs.

## Ten questions to ask

These queries work today. They are not claims that Fiddler cannot answer them. The local follow-ups and business definitions add your context.

1. Which production windows have no recorded review? Use queue.
2. How different is this week's order-size distribution from the reference? Use drift.
3. How many predictions still lack an observed result? Use quality or performance.
4. Are forecasts consistently above actual demand? Use performance for signed bias.
5. Which business region has the largest observed error? Use segments and its sample counts.
6. Did missing input values change the comparison? Use drift and its missing count.
7. Who owns overdue follow-ups for models needing review? Use queue and actions.
8. Which thresholds and evidence supported the previous review? Use evaluations.
9. Which extracts were reconciled and imported, and by whom? Use imports and history.
10. Which model records have passed their evidence or retention review dates? Use compliance.

## Documents and views

npm run view renders a read-only weekly dashboard. npm run docs renders a monitoring definition card and remediation brief per model. Set the business name, colours and logo in brand.json. /draft-review writes a new private HTML file under drafts and refuses overwrite. Generated record text is escaped. A browser can print these working papers to PDF. [Why no front end](docs/why-no-front-end.md).

## Your first hour: ten things to ask for

1. Put our name and colours on the reports.
2. Name the forecasts we actually depend on.
3. Register the deployed model version and its owner.
4. Record the unit and a single input feature to monitor first.
5. Agree fixed boundaries and review limits before looking at results.
6. Set a defensible sample minimum for our operating volume.
7. Map and reconcile the reference and production exports.
8. Inspect the import dry run before loading.
9. Assign the first missing-outcome follow-up.
10. Add our own weekly report through /new-view.

/customise adds fields and rules with migrations and tests. Changed metric definitions get a new version. /compliance checks evidence dates, incomplete windows and retention review dates against the cited rules in [compliance support](docs/compliance.md). A clear check is not a legal or technical certification.

```bash
npm run monitor -- export --file=exports/backup-YYYY-MM-DD.json
```

Exports include all eight record types and refuse overwrite. Native backup and tested restore remain necessary. There is no JSON restore command. [Validation evidence](docs/validation.md).

Built and optionally operated through [Omni by Enterprise DNA](https://enterprisedna.co/omni/instead-of/fiddler).
