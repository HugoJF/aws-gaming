# Dependency Preferences

## Rules

- Add dependencies only when a concrete feature requires them.
- Prefer platform and standard library features first.
- Prefer shared code in `packages/*` before adding another library.
- Record a one-line reason for each new dependency in the PR description.
- Keep frontend libraries minimal until the related UI feature is approved.

## Initial policy

- API: use only `hono` and Lambda adapter dependencies needed to run.
- Web: use Vite + React baseline only.
- Infrastructure: keep Terraform native unless a provider/module is necessary.
