# @aws-gaming/auth-links

Opaque token creation/hash/expiry/revocation helpers.

## Source

- `packages/auth-links/src/index.ts`

## Token Format

`createOpaqueToken()` returns:

- `<word>-<word>-<random-suffix>`

The random suffix is generated with `randomBytes` and remains the cryptographic entropy source.

## Commands

```bash
bun run --cwd packages/auth-links build
bun run --cwd packages/auth-links typecheck
```
