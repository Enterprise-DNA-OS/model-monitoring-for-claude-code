# Metric definitions

This desk analyses numerical regression observations. Each monitor has one selected numerical feature and a numerical prediction and actual value in the same declared unit. It does not compare different model versions. Business segments are explicitly supplied, never inferred.

## Distribution distance

Fixed cut points define half-open bins. With cuts [50,100], values below 50 are in the first bin, 50 through values below 100 in the second, and 100 or greater in the third. Missing features have a separate bin and remain in the denominator. Distance is half the sum of the absolute differences between the reference and production proportions. It ranges from zero to one. This is total variation distance, not a p-value, not Fiddler's default drift implementation and not proof of error. It can miss changes within a bin. Bin choice, sample size and seasonality matter.

The configured drift limit is exceeded strictly, using >, not >=. Both windows need at least min_samples observations before a distribution alert is raised. Missing features are also reported separately. A stable missingness rate does not establish data quality.

## Forecast error

Only rows with an actual result contribute. MAE is the mean absolute value of prediction minus actual. RMSE is the square root of mean squared error. Bias is mean prediction minus actual: positive means over-forecasting. Outcomes equal to zero are valid outcomes. Unknown outcomes are excluded and counted, never filled with zero. Metrics are descriptive on the labelled subset; delayed or selectively returned outcomes can bias them. They are not an estimate for missing outcomes.

At least min_samples observed outcomes are needed for an error alert. Metrics still display for smaller samples with an insufficient-evidence finding. A model gets needs review if either supported check exceeds its limit; it can also have an insufficient-outcomes finding. Read the complete saved result, not only its status. A within-configured-limits status is not a deployment decision. The demo limits are illustrative, not statistical or legal standards.

## Evidence boundaries

All windows use UTC instants and the interval [start,end). The reference must end at or before production starts. Counts must match the manifest; event IDs must be unique within a snapshot. A stable event ID cannot demonstrate completeness on its own. The same event can occur in different snapshots; each comparison uses exactly one reference and one production snapshot, never a combined total. Select non-overlapping windows when comparing history.

Each dataset is immutable. Later actuals require a new full snapshot ID and a new evaluation; the old evaluation stays true to the evidence available then. Definitions, limits and cuts are immutable. Changes require a new model record. Evaluations save source IDs, algorithm version, limits, bins and counts. The queue names production snapshots without any evaluation; a historical review does not cover them.

Numeric values must be finite decimal numbers between minus one trillion and one trillion. Computation uses double precision. Do not use these metrics for monetary settlement. This implementation handles local review-sized datasets in memory; benchmark larger volumes before deployment.
