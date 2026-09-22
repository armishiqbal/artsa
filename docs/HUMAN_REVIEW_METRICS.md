# Human Review Metrics

ARTSA separates benchmark/campaign outcomes from production-quality evidence.
`POST /api/v1/reviews` records a tenant-scoped operator label for a stable event,
finding, or external source reference. Valid classifications are `true_positive`,
`false_positive`, `false_negative`, `true_negative`, and `inconclusive`.

The record deliberately contains no prompt, tool arguments, model output, or
free-text analyst note. It retains only the source reference, machine verdict,
classification, and bounded reason code. Submitting the same tenant/source pair
corrects the current label rather than double-counting it.

`GET /api/v1/reviews/metrics` reports precision, recall, false-positive rate,
and false-negative rate strictly from these human labels. Until a denominator
exists, each rate is `null`; ARTSA must not substitute campaign or synthetic
numbers for an unavailable production metric.
