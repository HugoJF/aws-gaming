# TODO

Last updated: 2026-02-21

## High Priority

## Medium Priority

- [ ] Tighten remaining API Lambda IAM wildcard permissions where practical.
- [ ] Add alarms for Lambda errors and elevated duration.
- [ ] Add alarms for ECS service health mismatch (`runningCount < desiredCount`) and ASG unhealthy instances.
- [x] Revisit Bootstrap screen code after TanStack Query integration; simplify flow and split logic into smaller maintainable pieces (code quality, not visual redesign).
- [x] Remove Terraform configurability for `function_url_auth_type`; hardcode API Function URL auth type to `NONE`.
- [ ] Fix `GET https://minecraft.aws.hugo.dev.br:8080/ping` failing with `net::ERR_SSL_PROTOCOL_ERROR`.

## Low Priority

- [ ] Tune CloudWatch attack-detection alarm thresholds for the public API Lambda based on real baseline traffic.
- [ ] Wire alarm actions (SNS or incident channel) so suspicious traffic patterns page the team.
- [ ] Add Terraform deployment pipeline with `plan` artifact + manual approval for `apply`.
- [ ] Clean up docs and consolidate relevant operational/architecture information.
- [x] Split `apps/api/src/index.ts` into multiple files (low).
- [x] Document how DynamoDB is set up and managed in this project (low).
- [x] Assume health sidecar is always enabled and remove conditional branches (`health_sidecar_enabled`) to simplify Terraform/module concat logic.
- [ ] Use a routing library instead of manual `history.replaceState` URL syncing in `App.tsx`.
