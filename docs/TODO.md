# TODO

Last updated: 2026-02-12

## High Priority

- [ ] Tune CloudWatch attack-detection alarm thresholds for the public API Lambda based on real baseline traffic.
- [ ] Wire alarm actions (SNS or incident channel) so suspicious traffic patterns page the team.
- [ ] Migrate EFS to One Zone for game workloads now (cost-optimized; avoid later migration overhead; acceptable risk of data loss on AZ-level failure; verify ECS/EC2 placement is pinned to the same AZ as EFS mount target).
- [x] Add capacity-provider-based ECS service placement to ensure each service targets its intended EC2 capacity in a shared cluster.

## Medium Priority

- [ ] Tighten remaining API Lambda IAM wildcard permissions where practical.
- [ ] Add alarms for Lambda errors and elevated duration.
- [ ] Add alarms for ECS service health mismatch (`runningCount < desiredCount`) and ASG unhealthy instances.
- [x] Use ECS service health status directly in the API health-check list output.
- [x] Adopt TanStack Query in web app so PATCH/POST mutations invalidate and refresh relevant lists, and recent data is reused when switching between server/admin views instead of refetching immediately.
- [ ] Split large React Query hooks into focused query/mutation hooks and smaller files (avoid monolithic `useQuery`+`useMutation` hooks).
- [ ] Revisit Bootstrap screen code after TanStack Query integration; simplify flow and split logic into smaller maintainable pieces (code quality, not visual redesign).
- [ ] Remove Terraform configurability for `function_url_auth_type`; hardcode API Function URL auth type to `NONE`.
- [ ] Fix `GET https://minecraft.aws.hugo.dev.br:8080/ping` failing with `net::ERR_SSL_PROTOCOL_ERROR`.

## Low Priority

- [ ] Add Terraform deployment pipeline with `plan` artifact + manual approval for `apply`.
- [x] Align API naming: rename `GET /api/admin/instances` to an admin-scoped server naming scheme (for example `GET /api/admin/servers`) and keep `/api/servers` for token-scoped runtime server views.
- [x] Generate human-friendly access tokens using two random words (while preserving secure entropy).
- [ ] Clean up docs and consolidate relevant operational/architecture information.
- [ ] Split `apps/api/src/index.ts` into multiple files (low).
- [ ] Document how DynamoDB is set up and managed in this project (low).
- [ ] Assume health sidecar is always enabled and remove conditional branches (`health_sidecar_enabled`) to simplify Terraform/module concat logic.
