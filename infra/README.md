# infra

Infrastructure definitions.

- Terraform entrypoint: `infra/terraform/stack`
- Reusable modules: `infra/terraform/modules`
- Deploy/runbook: `infra/terraform/README.md`

Primary workflow:

```bash
bun run build:api:lambda
bun run tf:init
bun run tf:plan:hello
bun run tf:apply:hello
```
