# Admin API Plan

Last updated: 2026-02-11

## Scope

- Build real admin API + frontend wiring for token management.
- Replace all mock admin data/hooks in `apps/web`.
- Keep existing bearer-token auth model (public API endpoint, app-level auth).

Out of scope:
- RBAC beyond `isAdmin`
- audit log storage
- multi-tenant org model

## Resolved Decisions

- Admin identity: `isAdmin: true` on `SecretAccessToken`.
- Token lifetime: support `expiresAt: string | null` (`null` = never expires).
- Token revocation: soft revoke using `revokedAt`.
- Admin endpoints live under `/api/admin/*`.
- Use existing DynamoDB single table; scans are acceptable at current scale.

## API Surface

### Existing auth-required API

- `GET /api/me`
  - Returns token context used by frontend admin gate.
  - Response:
    - `tokenId`
    - `isAdmin`
    - `gameInstanceIds`

### Admin API (requires `isAdmin`)

- `GET /api/admin/tokens`
  - List all tokens as admin view models.
- `POST /api/admin/tokens`
  - Create token; returns raw token once.
- `PATCH /api/admin/tokens/:id`
  - Update mutable fields (`label`, `gameInstanceIds`, `expiresAt`).
- `POST /api/admin/tokens/:id/revoke`
  - Set `revokedAt`.
- `GET /api/admin/instances`
  - List all registered game instances for token-scoping UI.

## Contract Changes

`packages/contracts/src/index.ts`

- `SecretAccessToken`
  - `expiresAt: string | null`
  - `isAdmin?: boolean`
- Add:
  - `TokenStatus = 'active' | 'revoked' | 'expired'`
  - `MeResponse`
  - `AdminTokenView`
  - `AdminInstanceView`
  - `AdminListTokensResponse`
  - `AdminCreateTokenRequest`
  - `AdminCreateTokenResponse`
  - `AdminUpdateTokenRequest`
  - `AdminUpdateTokenResponse`
  - `AdminRevokeTokenResponse`
  - `AdminListInstancesResponse`

## Auth Helpers

`packages/auth-links/src/index.ts`

- Update `isTokenExpired(expiresAtIso: string | null)`:
  - `null` => `false`
- Add `computeTokenStatus(expiresAt, revokedAt, now?)`:
  - `revoked` > `expired` > `active`

## API Layer Changes

### Middleware

`apps/api/src/middleware/auth.ts`

- Extend `AuthContext`:
  - `isAdmin: boolean`
- Populate from token record.
- Add `createAdminMiddleware()`:
  - 403 when `isAdmin !== true`.

### Repository

`apps/api/src/db/repository.ts`

- Add:
  - `getTokenById(id)` (scan filtered by `entityType` + `id`)
  - `updateTokenByHash(tokenHash, patch)`
  - `revokeTokenByHash(tokenHash, revokedAt)`
- Reuse existing:
  - `listTokens()`
  - `listInstances()`
  - `putToken()`

### Routes

`apps/api/src/index.ts`

- Add `GET /api/me`.
- Add `admin` sub-app:
  - `admin.use('*', authMiddleware, adminMiddleware)`
  - mount with `api.route('/admin', admin)`

Validation rules:
- Reject empty `gameInstanceIds` on token create/update.
- Reject unknown instance IDs.
- Reject patch requests with no mutable fields.

ID/token generation:
- `id`: `tok_${crypto.randomUUID().slice(0, 8)}`
- `rawToken`: `createOpaqueToken()`
- `tokenHash`: `hashOpaqueToken(rawToken)`
- `tokenPrefix` in admin view: first 8 chars of hash

## Frontend Changes

### API Client

`apps/web/src/lib/api.ts`

- Add:
  - `getMe(token)`
  - `adminListTokens(token)`
  - `adminCreateToken(token, input)`
  - `adminUpdateToken(token, id, input)`
  - `adminRevokeToken(token, id)`
  - `adminListInstances(token)`

### Admin Gate

`apps/web/src/hooks/use-admin-mode.ts`

- Replace hardcoded `admin-secret` logic.
- Resolve from `api.getMe(token).isAdmin`.
- Fallback to non-admin view on 401/403.

### Admin Data Hook

Create `apps/web/src/hooks/use-admin-tokens.ts`

- Load tokens + instances via `Promise.all`.
- Expose:
  - `tokens`
  - `instances`
  - `lastCreated`
  - `create/update/revoke`
  - loading/error state

### Component Wiring

- `apps/web/src/components/admin/admin-view.tsx`
  - use real hook instead of `use-mock-tokens`.
- `apps/web/src/App.tsx`
  - pass current auth token into admin view/hook path.
- Replace imports from `@/lib/mock-admin-data` with contracts types.

Cleanup:
- delete `apps/web/src/hooks/use-mock-tokens.ts`
- delete `apps/web/src/lib/mock-admin-data.ts`

## Optional Bootstrap (First Admin)

If table has zero tokens, allow one-time admin token creation path.

Preferred flow:
- frontend shows "Initialize admin" screen when `/api/me` cannot be resolved and token table is empty (dedicated endpoint).
- backend allows bootstrap creation only when token count is zero.

Alternative:
- one-off script writing first admin token to DynamoDB.

## Implementation Order

1. Contracts + auth-links updates.
2. Middleware + repository admin methods.
3. `/api/me` + `/api/admin/*` routes.
4. Web API client methods.
5. Replace admin-mode/auth gate with real `/api/me`.
6. Replace mock admin data hook and wire components.
7. Remove mock admin files.

## Verification

1. `bun run --cwd packages/contracts typecheck`
2. `bun run --cwd packages/auth-links typecheck`
3. `bun run --cwd apps/api typecheck`
4. `bun run --cwd apps/web typecheck`
5. E2E manual:
   - admin token can list/create/update/revoke tokens
   - non-admin token gets 403 on `/api/admin/*`
   - revoked/expired tokens cannot call `/api/*`
