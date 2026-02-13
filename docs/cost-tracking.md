# Cost Tracking (Per Server)

Goal: "per-server" cost tracking with (a) hourly updates and (b) last-30-days view and/or 30-day forecast.

Reality check: AWS billing data is not real-time. You can get **hourly buckets** of cost data, but the data itself arrives with **lag**. If you need "updates every hour", you usually implement an **estimator** and reconcile later with billing-accurate sources.

## Options

| Option | Last 30 days with hourly buckets? | Freshness / update cadence | 30-day forecast? | Pros | Cons | Cost |
|---|---:|---|---:|---|---|---|
| CUR / Data Exports (CUR 2.0) -> S3 -> Athena (HOURLY) | Yes | Updates are at least daily (sometimes multiple times/day), not hourly | Not built-in | Most detailed; best for per-server attribution via tags/resource IDs; long history | More plumbing (S3, Glue/Athena); still delayed | S3 storage/requests + Athena query scans (historically ~$5/TB scanned). See Athena + S3 pricing. |
| Cost Explorer API (hourly granularity enabled) | No (hourly is limited to last 14 days) | Lagged; not "today so far" | Forecast exists but is DAILY/MONTHLY, not hourly | Simple API; no data lake | Doesn't satisfy last-30-days hourly; per-server needs cost allocation tags and may still be coarse | Cost Explorer is priced per API request (historically ~$0.01/request) + hourly granularity hosting (historically ~$0.01 per 1,000 usage records-month). See Cost Explorer pricing. |
| Cost Explorer API (DAILY) + GetCostForecast (DAILY) | No | Lagged; typically through yesterday | Yes (daily forecast) | Easiest last-30-days + next-30-days story | Not hourly; still delayed | Cost Explorer is priced per API request (historically ~$0.01/request). See Cost Explorer pricing. |
| Near-real-time estimator (our own) (runtime * price) | Yes (we define it) | We can refresh every hour (or more often) | Yes (extrapolate) | Only way to get "current cost today" style updates | Not billing-accurate; needs modeling for shared infra/discounts/data transfer | Our compute/storage (no billing API required) |

## Recommended Hybrid (Practical)

If we want hour-by-hour numbers in the UI:

1. **Estimator for "now"**
   - Track per-instance/server runtime intervals (boot start -> shutdown complete) and resource sizes (instance type, desired counts, storage).
   - Compute hourly and daily estimates; refresh every hour.
   - Mark explicitly as **Estimated**.

2. **Billing-accurate reconciliation**
   - Tag resources with something like `GameInstanceId=<id>` and activate cost allocation tags.
   - Use CUR / Data Exports to backfill "actual" costs, and compare to estimator.

3. **Forecast**
   - Use Cost Explorer forecast for daily/monthly predictions.
   - For an "hourly-looking" forecast graph, interpolate daily forecast values, but keep the label as forecasted daily totals.

## Notes On "Per Server"

Per-server attribution is easiest when each server has dedicated resources (e.g., its own ASG/EC2/EBS/EFS). If multiple servers share cluster capacity, you either:

- Accept "tag-based, coarse attribution" (some cost remains shared/unknown), or
- Implement split allocation rules (or a custom allocation model), or
- Put each server on isolated capacity (more expensive, but cleaner accounting).

## Pointers

- Cost Explorer pricing: https://aws.amazon.com/aws-cost-management/aws-cost-explorer/pricing/
- Athena pricing: https://aws.amazon.com/athena/pricing/
- S3 pricing: https://aws.amazon.com/s3/pricing/
