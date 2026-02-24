# DynamoDB Runtime Table Structure (API)

This document describes only the runtime table structure used by `apps/api`.
Focus: keys, attributes, and TTL.

## Physical Table

Defined in Terraform (`infra/terraform/modules/api/main.tf`, resource `aws_dynamodb_table.api`).

- Billing mode: `PAY_PER_REQUEST`
- Partition key: `pk` (string)
- Sort key: `sk` (string)
- TTL attribute: `ttl` (enabled)
- GSIs/LSIs: none

## Key Pattern Summary

| Entity | `pk` | `sk` |
|---|---|---|
| `GameInstance` | `INSTANCE#{instanceId}` | `INSTANCE` |
| `TransitionIntent` | `INSTANCE#{instanceId}` | `TRANSITION` |
| `CachedStatus` | `INSTANCE#{instanceId}` | `STATUS_CACHE` |
| `SecretAccessToken` | `TOKEN#{tokenHash}` | `TOKEN` |
| `GameTemplate` | `TEMPLATE#{templateId}` | `TEMPLATE` |

## Entity Structures

### GameInstance

Key:
- `pk = INSTANCE#{id}`
- `sk = INSTANCE`

Attributes:
- `entityType`: Logical discriminator for single-table records (`GameInstance`).
- `id`: Unique game instance identifier.
- `templateId`: Template identifier this instance was derived from.
- `displayName`: Human-readable instance name shown in UI.
- `gameType`: Game family (`minecraft`, `zomboid`, `generic`).
- `gameLabel`: Human-readable game label.
- `dnsName?`: Optional DNS hostname used to reach the server.
- `location`: Human-readable region/location label.
- `maxPlayers`: Configured maximum player capacity.
- `hostPort`: Primary gameplay port exposed by the service.
- `healthPort`: Health sidecar port used for health probing.
- `queryPort?`: Optional game query port when different from `hostPort`.
- `ecsClusterArn`: ARN of the ECS cluster hosting the service.
- `ecsServiceName`: ECS service name for this instance.
- `autoScalingGroupName`: Backing Auto Scaling Group name.
- `route53ZoneId?`: Optional Route53 hosted zone ID for DNS updates.
- `instanceCount`: Desired EC2 instance count for this workload.
- `taskCount`: Desired ECS task count for this workload.
- `desiredState?`: Last requested power intent (`on` or `off`).

### TransitionIntent

Key:
- `pk = INSTANCE#{instanceId}`
- `sk = TRANSITION`

Attributes:
- `entityType`: Logical discriminator for single-table records (`TransitionIntent`).
- `action`: Target power action (`on` for boot, `off` for shutdown).
- `firedActions`: Stage IDs whose side-effect action has already run.
- `startedAt`: ISO timestamp when transition started.
- `deadlineAt`: ISO timestamp for soft transition deadline.
- `deadlineExceededAt?`: ISO timestamp set when deadline was exceeded.
- `ttl`: Epoch seconds used by DynamoDB TTL for cleanup.

TTL:
- Stored as epoch seconds
- Value set to `now + 86400` (24h)

### CachedStatus

Key:
- `pk = INSTANCE#{instanceId}`
- `sk = STATUS_CACHE`

Attributes:
- `entityType`: Logical discriminator for single-table records (`CachedStatus`).
- `instanceId`: Owning game instance ID.
- `status`: Computed server status (`online`, `offline`, `booting`, `shutting-down`, `error`).
- `liveData`: Optional runtime game telemetry (players/server metadata).
- `publicIp?`: Optional resolved public IPv4 of active compute.
- `healthChecks`: Component health check results used to assess status.
- `fetchedAt`: ISO timestamp when this status snapshot was generated.
- `ttl`: Epoch seconds used by DynamoDB TTL for cleanup.

TTL:
- Stored as epoch seconds
- Value set to `now + 3600` (1h)

### SecretAccessToken

Key:
- `pk = TOKEN#{tokenHash}`
- `sk = TOKEN`

Attributes:
- `entityType`: Logical discriminator for single-table records (`SecretAccessToken`).
- `id`: Stable token identifier exposed to admin UI/API.
- `tokenHash`: Hashed opaque token value (raw token is never stored).
- `label?`: Optional operator-provided label for identification.
- `gameInstanceIds`: IDs of instances this token is authorized to access.
- `expiresAt`: ISO timestamp when token expires, or `null` for no expiry.
- `isAdmin?`: Whether token has admin privileges.
- `revokedAt?`: ISO timestamp when token was revoked.
- `createdAt`: ISO timestamp when token was created.

TTL:
- Not set by current API logic

### GameTemplate

Key:
- `pk = TEMPLATE#{id}`
- `sk = TEMPLATE`

Attributes:
- `entityType`: Logical discriminator for single-table records (`GameTemplate`).
- `id`: Unique template identifier.
- `displayName`: Human-readable template name.
- `gameType`: Game family the template targets.
- `containerImage`: Container image reference used by the service.
- `containerPorts`: Container ports exposed by this template.
- `queryPort?`: Optional default query port for server probing.
- `defaultMaxPlayers`: Default max-player value for instances from this template.

TTL:
- Not set by current API logic

## Access Patterns

Current repository behavior (`apps/api/src/db/repository.ts`):

- Uses `GetItem`, `PutItem`, `DeleteItem`, and `Scan`.
- Does not currently use `Query`.

### GameInstance access patterns

| Access pattern | Repository method | DynamoDB operation | Key/index used |
|---|---|---|---|
| Load one instance | `getInstance(id)` | `GetItem` | `pk=INSTANCE#{id}, sk=INSTANCE` |
| List all instances | `listInstances()` | `Scan` + filter `entityType=GameInstance` | Full table scan |
| Persist instance | `putInstance(instance)` | `PutItem` | `pk=INSTANCE#{id}, sk=INSTANCE` |

### TransitionIntent access patterns

| Access pattern | Repository method | DynamoDB operation | Key/index used |
|---|---|---|---|
| Load transition | `getTransition(instanceId)` | `GetItem` | `pk=INSTANCE#{id}, sk=TRANSITION` |
| Persist transition | `putTransition(...)` | `PutItem` | `pk=INSTANCE#{id}, sk=TRANSITION` |
| Delete transition | `deleteTransition(instanceId)` | `DeleteItem` | `pk=INSTANCE#{id}, sk=TRANSITION` |

### CachedStatus access patterns

| Access pattern | Repository method | DynamoDB operation | Key/index used |
|---|---|---|---|
| Load cached status | `getCachedStatus(instanceId)` | `GetItem` | `pk=INSTANCE#{id}, sk=STATUS_CACHE` |
| Persist cached status | `putCachedStatus(status)` | `PutItem` | `pk=INSTANCE#{id}, sk=STATUS_CACHE` |

### SecretAccessToken access patterns

| Access pattern | Repository method | DynamoDB operation | Key/index used |
|---|---|---|---|
| Auth lookup by bearer token hash | `getTokenByHash(tokenHash)` | `GetItem` | `pk=TOKEN#{tokenHash}, sk=TOKEN` |
| List all tokens | `listTokens()` | `Scan` + filter `entityType=SecretAccessToken` | Full table scan |
| Lookup token by token id | `getTokenById(id)` | paginated `Scan` + filter (`entityType` and `id`) | Full table scan |
| Update token (by hash) | `updateTokenByHash(...)` | `GetItem` + `PutItem` | `pk=TOKEN#{tokenHash}, sk=TOKEN` |
| Revoke token (by hash) | `revokeTokenByHash(...)` | `GetItem` + `PutItem` | `pk=TOKEN#{tokenHash}, sk=TOKEN` |

### GameTemplate access patterns

| Access pattern | Repository method | DynamoDB operation | Key/index used |
|---|---|---|---|
| Load one template | `getTemplate(id)` | `GetItem` | `pk=TEMPLATE#{id}, sk=TEMPLATE` |
| List all templates | `listTemplates()` | `Scan` + filter `entityType=GameTemplate` | Full table scan |
| Persist template | `putTemplate(template)` | `PutItem` | `pk=TEMPLATE#{id}, sk=TEMPLATE` |

## TTL Notes

- Table-level TTL is enabled on attribute `ttl`.
- Only `TransitionIntent` and `CachedStatus` currently include `ttl` values.
- DynamoDB TTL deletion is asynchronous; expired items may remain visible for some time.

## Structure Notes

- `entityType` is used as a logical discriminator in a single-table design.
- Because there are no GSIs, non-key lookups are scan-based in current repository methods.
