# TODO

Last updated: 2026-02-12

## High Priority

- [ ] Tune CloudWatch attack-detection alarm thresholds for the public API Lambda based on real baseline traffic.
- [ ] Wire alarm actions (SNS or incident channel) so suspicious traffic patterns page the team.
- [ ] Add capacity-provider-based ECS service placement to ensure each service targets its intended EC2 capacity in a shared cluster.

## Medium Priority

- [ ] Tighten remaining API Lambda IAM wildcard permissions where practical.
- [ ] Add alarms for Lambda errors and elevated duration.
- [ ] Add alarms for ECS service health mismatch (`runningCount < desiredCount`) and ASG unhealthy instances.
- [ ] Use ECS service health status directly in the API health-check list output.
- [ ] Adopt TanStack Query in web app so PATCH/POST mutations invalidate and refresh relevant lists, and recent data is reused when switching between server/admin views instead of refetching immediately.

## Low Priority

- [ ] Add Terraform deployment pipeline with `plan` artifact + manual approval for `apply`.
- [ ] Align API naming: rename `GET /api/admin/instances` to an admin-scoped server naming scheme (for example `GET /api/admin/servers`) and keep `/api/servers` for token-scoped runtime server views.
