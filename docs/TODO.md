# TODO

Last updated: 2026-02-21

## High Priority

## Medium Priority

- [ ] Tighten remaining API Lambda IAM wildcard permissions where practical.
- [ ] Add alarms for Lambda errors and elevated duration.
- [ ] Add alarms for ECS service health mismatch (`runningCount < desiredCount`) and ASG unhealthy instances.

## Low Priority

- [ ] Tune CloudWatch attack-detection alarm thresholds for the public API Lambda based on real baseline traffic.
- [ ] Wire alarm actions (SNS or incident channel) so suspicious traffic patterns page the team.
- [ ] Add Terraform deployment pipeline with `plan` artifact + manual approval for `apply`.
