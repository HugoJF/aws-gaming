# infra

Infrastructure definitions.

- Terraform entrypoint: `infra/terraform/stack`
- Reusable modules: `infra/terraform/modules`
- Deploy/runbook: `infra/terraform/README.md`

Primary workflow:

```bash
make api-lambda
make tf-init
make tf-plan
make tf-apply
```
