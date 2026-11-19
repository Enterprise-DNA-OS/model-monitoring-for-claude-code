# Switch the numerical monitoring review from Fiddler

Fiddler here means the model monitoring vendor at fiddler.ai, not Telerik's web debugger. Scope a prepared migration day around one regression model, one input feature, numerical predictions and actual outcomes. Keep the wider platform until every dependency has been reviewed.

## 1. Export the evidence

Use the vendor's [Model.download_data documentation](https://docs.fiddler.ai/sdk-api/python-client/model#download_data). The method writes CSV when output_format is DownloadFormat.CSV. Export the baseline from PRE_PRODUCTION with its env_id, and the production window from PRODUCTION with explicit start_time and end_time. Project READ permission is required. Draft models cannot use this method.

Set max_rows deliberately and reconcile the returned row count against the source. The documented default is 1,000 rows and the maximum is 10,000,000. An export that hits its cap needs reconciliation or narrower windows before use. Do not assume that the default download contains all history. No vendor credentials are handled by this repo.

## 2. Map your actual columns

The exported headers belong to your model. There is no universal Fiddler header set. Copy examples/manifest.json to a private imports folder and map event_id, occurred_at, feature, prediction, actual and segment to the exact headers. Empty feature and actual fields become unknown. Prediction, stable event ID, timezone-qualified timestamp and segment are required. Add an explicit constant business segment to a prepared export if none exists, recording that preparation. Do not silently invent IDs or outcomes.

Each file specifies a unique snapshot external_id, kind, UTC window and independently reconciled expected_count. A bundle can hold a reference and one or more production windows. Record the source account, model version, filters, export time, preparation and completeness checks in source_ref. Only mapped values are retained; unselected raw columns are not silently copied. Keep the original under your own retention policy.

## 3. Register, test and import

Run npm run monitor -- help and use add-model with the source, stable model ID, version, feature, unit, owner, purpose, cuts, limits, sample minimum and agreed review dates. Then:

```bash
npm run monitor -- import fiddler --model="Your model v1" --manifest=imports/manifest.json --actor="Actual operator" --dry-run
npm run monitor -- import fiddler --model="Your model v1" --manifest=imports/manifest.json --actor="Actual operator"
```

Each bundle is atomic. Invalid dates, duplicated event IDs, missing mapped columns, mismatched counts and conflicting evidence reject the whole bundle. A repeated identical bundle is skipped. Use a new snapshot ID for corrections or newly available actuals; old observations and evaluations stay intact.

## 4. Reconcile before switching

Compare source and loaded counts, units, timestamps, nulls, segments and observed outcomes. Run quality, drift, performance and segments before evaluate. This desk uses its documented fixed-bin total variation distance. Do not expect the same value as a different Fiddler metric or a differently configured window. Import does not bring dashboards, alert routes, trained model files, explanatory models, approval policies, text traces or vendor access permissions. Enterprise DNA maps and builds the agreed extra workflows around your version.

A prepared and reconciled pair of exports can be loaded in one command during a migration day. Export access, missing history, source reconciliation and extra requirements determine the real schedule. Validate the full business workflow before ending any vendor service.
