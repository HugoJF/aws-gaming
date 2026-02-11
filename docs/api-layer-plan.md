# TODO: API Layer for Game Server Dashboard

## Context

The frontend dashboard is built (server cards with power toggles, boot sequences, health checks, latency). It currently uses hardcoded mock data. We need the real API layer so the frontend can list servers, poll status, and control power — backed by ECS/ASG infrastructure and GameDig for live game data.

## Architecture Summary

- **Runtime**: Hono on Lambda with Function URL (no API Gateway)
- **Lambda NOT in VPC** — simpler, allows outbound UDP for GameDig
- **Auth**: Opaque bearer tokens validated via DynamoDB lookup
- **Live data**: GameDig queries game servers via Lambda for players/server info
- **Latency**: Measured by the **browser directly** — pings a lightweight HTTP sidecar on the EC2 instance via the game's DNS name
- **DNS**: Route53 record updated during boot; reachability is both a boot stage and a health check
- **Status polling**: Frontend polls per-server at adaptive intervals
- **Power sequences**: Poll-driven state machine in DynamoDB (no Step Functions)

---

## 1. Latency & DNS Design

### Browser-measured latency

The Lambda API does **not** measure latency. Instead:

1. Each game EC2 instance runs a **health sidecar** — a second container in the ECS task definition that serves a tiny HTTP endpoint on a fixed port (e.g., `8080`).
2. The sidecar responds to `GET /ping` with `{ "ts": <unix_ms> }` and appropriate CORS headers.
3. The **frontend** calls `https://<dns_name>:8080/ping` directly and measures the round-trip time. This gives the user's real latency to the game server, not the Lambda-to-server latency.
4. The sidecar image is a minimal container (e.g., a static Go/Bun binary, ~5MB) that we build once and reuse across all game services.

### DNS as infrastructure

- Each game instance has a `dns_name` (e.g., `mc-survival.play.example.com`).
- During boot, after the EC2 instance gets a public IP, the backend updates the Route53 A record to point to that IP.
- During shutdown, after scaling down, the backend deletes/clears the Route53 record.

### DNS in boot sequence

"Updating DNS" is a boot stage: the backend writes the Route53 record and verifies propagation (the record resolves to the expected IP).

### DNS as health check

- **Backend check**: Route53 record exists and resolves to the correct instance IP (via `dns.resolve` or Route53 API).
- **Frontend check**: The browser's ability to reach `https://<dns_name>:8080/ping` implicitly proves DNS is working. If the ping fails, the frontend shows DNS/network as degraded.

---

## 2. Terraform Changes for Sidecar + DNS

### ECS Task Definition (game-service module)

Add a second container to the existing task definition:

```hcl
container_definitions = jsonencode([
  {
    name              = var.game_instance_id
    image             = var.container_image
    essential         = true
    memoryReservation = var.container_memory_reservation
    portMappings      = [{ containerPort = var.container_port, hostPort = var.host_port, protocol = "tcp" }]
  },
  {
    name              = "health-sidecar"
    image             = var.health_sidecar_image   # new variable
    essential         = false                       # game can run without it
    memoryReservation = 32                          # tiny
    portMappings      = [{ containerPort = 8080, hostPort = var.health_port, protocol = "tcp" }]
  }
])
```

### Security Group

Add ingress rule for the health sidecar port:

```hcl
resource "aws_vpc_security_group_ingress_rule" "health" {
  for_each          = toset(var.allowed_ingress_cidrs)
  security_group_id = aws_security_group.instance.id
  cidr_ipv4         = each.value
  from_port         = var.health_port
  to_port           = var.health_port
  ip_protocol       = "tcp"
  description       = "Allow health sidecar traffic"
}
```

### New Variables

- `health_sidecar_image` — Docker image for the ping sidecar (default to a shared ECR image or public image)
- `health_port` — Host port for sidecar (default `8080`)
- `route53_zone_id` — Hosted zone for DNS records (optional, enables DNS features)

### Route53 Resources

DNS updates are **not** managed by Terraform (they change dynamically with instance IPs). Instead, the API Lambda calls Route53 directly during the boot/shutdown state machine. The Terraform module only needs:

- A `route53_zone_id` variable passed through to the API (stored in DynamoDB with the game instance config)
- IAM permissions for the API Lambda to call `route53:ChangeResourceRecordSets`

---

## 3. API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/api/servers` | List all servers (initial load, full status) | Bearer token |
| `GET` | `/api/servers/:id/status` | Single server status (poll target) | Bearer token |
| `POST` | `/api/servers/:id/power` | Power on/off `{ action: 'on' \| 'off' }` | Bearer token |
| `GET` | `/health` | Healthcheck | None |

### Response shape: `ServerView`

```ts
interface ServerView {
  id: string;
  displayName: string;
  game: GameType;
  gameLabel: string;
  address: string;                // "dns:gamePort" or "ip:gamePort"
  healthEndpoint: string | null;  // "dns:healthPort" — for browser latency pings
  location: string;
  maxPlayers: number;
  status: ServerStatus;
  liveData: LiveData | null;      // GameDig data (players, server name, map)
  healthChecks: HealthCheck[];
  powerAction: PowerAction | null;
}

interface LiveData {
  players: number;
  maxPlayers: number;
  serverName: string;
  map: string | null;
  // NOTE: no latency here — latency is measured by the browser
}
```

### GET /api/servers

Called once on page load. Fetches all authorized servers with full status. Backend batches AWS API calls (`describeServices`, `describeAutoScalingGroups`) and fans out GameDig queries in parallel.

### GET /api/servers/:id/status

Lightweight poll target. Fetches DynamoDB record, checks cached status freshness (5s window), and if stale: calls AWS APIs + GameDig in parallel. Also **advances the power state machine** if a `powerAction` is in progress.

### POST /api/servers/:id/power

Validates current state, writes `powerAction` to DynamoDB, fires the first AWS API call, returns immediately. Subsequent status polls drive the rest. Returns 409 if already in requested state or transition in progress.

---

## 4. Polling Strategy

| Server State | API Poll Interval | Browser Ping Interval |
|---|---|---|
| `online` | 15s | 10s |
| `offline` | 60s | — (no pings) |
| `booting` / `shutting-down` | 3s | 5s (once DNS stage completes) |
| `error` | 10s | 30s |

**Deduplication**: Status responses are cached in DynamoDB with a 5s freshness window. Multiple tabs/users hitting the same server within 5s get the cached result.

**GameDig short-circuit**: Skip query when ECS `runningCount === 0`.

---

## 5. Health Checks

Five checks, derived from real AWS state + GameDig + DNS:

| Check | Source | Healthy | Degraded | Unhealthy |
|---|---|---|---|---|
| **EC2 Instance** | ASG `describeAutoScalingGroups` | All instances `InService` | Some `InService` | None `InService` |
| **ECS Task** | ECS `describeServices` | `runningCount === desiredCount` | `running > 0 && < desired` | `running === 0` when expected |
| **Game Process** | GameDig query | Query succeeds | N/A | Query fails/times out |
| **DNS** | Route53 API / DNS resolve | Record exists, resolves to correct IP | N/A | Record missing or wrong IP |
| **Network** | Browser ping to health sidecar | Ping succeeds (frontend-reported) | High latency (>200ms) | Ping fails |

When server is `offline`, all checks return `unknown` with detail "Server is off".

**Note**: The "Network" check is unique — it's reported **by the frontend** after attempting the browser ping. The API response includes the last known state but the frontend augments it with fresh ping results.

---

## 6. Power On Sequence (Boot Stages)

```
Stage                       AWS Action / Check                      ~Duration
────────────────────────── ──────────────────────────────────────── ─────────
1. Scaling infrastructure   ASG setDesiredCapacity(N), set min=N    60-120s
                            Poll ASG until instances InService

2. Registering to cluster   Automatic (ECS agent on EC2 boots)      15-30s
                            Poll listContainerInstances

3. Starting containers      ECS updateService(desiredCount=N)       10-30s
                            Poll describeServices until running
                            (game + health sidecar start)

4. Updating DNS             Get instance public IP from EC2          2-5s
                            Route53 ChangeResourceRecordSets
                            Verify record resolves to correct IP

5. Waiting for game         GameDig query until success              5-30s

6. Server ready             Write state='on', clear powerAction      <1s
```

**Driven by polls**: Each `GET /status` call checks the current stage condition and advances to the next if met.

**Timeouts**: Overall 10-minute deadline. Each stage has an individual max. Exceeded = stage marked `failed`, server status becomes `error`.

---

## 7. Power Off Sequence (Shutdown Stages)

```
Stage                       AWS Action / Check                      ~Duration
────────────────────────── ──────────────────────────────────────── ─────────
1. Stopping containers      ECS updateService(desiredCount=0)       10-30s
                            Poll until runningCount=0

2. Clearing DNS             Route53 delete A record                  1-2s

3. Draining instance        Automatic (ECS drains)                   5-10s
                            Poll listContainerInstances

4. Scaling down             ASG setDesiredCapacity(0), min=0        30-90s
                            Poll until instance count=0

5. Server stopped           Write state='off', clear powerAction     <1s
```

---

## 8. Contract Updates (`packages/contracts/src/index.ts`)

Expand from the current minimal types to include:

- `GameType` union: `'minecraft' | 'valheim' | 'cs2' | 'rust' | 'ark' | 'terraria'`
- `ServerStatus`: `'online' | 'offline' | 'booting' | 'shutting-down' | 'error'`
- `HealthCheckStatus`: `'healthy' | 'unhealthy' | 'degraded' | 'unknown'`
- `HealthCheck`: `{ name, status, detail, latency }`
- `LiveData`: `{ players, maxPlayers, serverName, map }` (no latency — browser measures that)
- `PowerAction` / `PowerStage`: boot/shutdown progress tracking with stage IDs
  - Boot stages: `scaling`, `registering`, `starting`, `dns_update`, `game_ready`, `ready`
  - Shutdown stages: `stopping`, `dns_clear`, `draining`, `scaling_down`, `stopped`
- `CachedServerStatus`: DynamoDB cache shape
- `ServerView`: full API response shape per server (includes `healthEndpoint` for browser pings)
- API request/response types
- Expand `GameTemplate` with `gameType`, `queryPort?`, `defaultMaxPlayers`
- Expand `GameInstance` with `hostPort`, `healthPort`, `location`, `instanceCount`, `taskCount`, `route53ZoneId`, AWS resource IDs, `powerAction?`, `cachedStatus?`

---

## 9. DynamoDB Schema

Single table: `aws-gaming-{environment}`, partition key `pk`, sort key `sk`.

| Entity | pk | sk | Notes |
|---|---|---|---|
| GameTemplate | `TEMPLATE#{id}` | `TEMPLATE` | Game type definitions |
| GameInstance | `INSTANCE#{id}` | `INSTANCE` | Server config + AWS resource IDs + Route53 zone |
| PowerAction | `INSTANCE#{id}` | `POWER_ACTION` | In-progress boot/shutdown (TTL 24h) |
| CachedStatus | `INSTANCE#{id}` | `STATUS_CACHE` | Live status cache (TTL 1h, 5s freshness) |
| SecretAccessToken | `TOKEN#{hash}` | `TOKEN` | Auth tokens |

Scale is small (<20 instances, <100 tokens) — scans filtered by `entityType` are fine.

---

## 10. Implementation Order

### Step 1: Update contracts
`packages/contracts/src/index.ts` — full type system

### Step 2: Implement aws-control with real AWS SDK
`packages/aws-control/src/index.ts`
- ASG: `describeAutoScalingGroups`, `setDesiredCapacity`, `updateAutoScalingGroup`
- ECS: `describeServices`, `updateService`, `listContainerInstances`
- EC2: `describeInstances` (get public IP for DNS update)
- Route53: `changeResourceRecordSets`, `listResourceRecordSets`
- Install `@aws-sdk/client-auto-scaling`, `@aws-sdk/client-ecs`, `@aws-sdk/client-ec2`, `@aws-sdk/client-route-53`

### Step 3: DynamoDB repository layer
`apps/api/src/db/repository.ts`
- CRUD for all entities
- Install `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`

### Step 4: GameDig service wrapper
`apps/api/src/services/gamedig.ts`
- Install `gamedig`

### Step 5: Status assembly + power state machine
`apps/api/src/services/status.ts`
- `buildHealthChecks()` — assembles checks from AWS APIs + GameDig + DNS
- `advancePowerAction()` — poll-driven state machine that advances boot/shutdown stages

### Step 6: Auth middleware
`apps/api/src/middleware/auth.ts`

### Step 7: Wire up Hono routes
`apps/api/src/index.ts`

### Step 8: Update frontend
- Replace hardcoded data with API calls
- Add `useServerPolling` hook with adaptive intervals
- Add `useLatencyPing` hook that pings `healthEndpoint` from the browser
- Refactor `boot-sequence.tsx` from timer-based to API-driven stages

### Step 9: Terraform changes
- **game-service module**: Add health sidecar container to task definition, health port SG rule, new variables
- **New module `infra/terraform/modules/api/`**: Lambda function, Function URL, IAM role, DynamoDB table
- **Stack**: Wire new variables through

Status: Implemented in Terraform. Remaining related work is application-level wiring (API logic, sidecar image publication, frontend integration).

### Step 10: Build health sidecar image
Tiny HTTP server (Bun or Go) that serves `GET /ping` with CORS. Push to ECR or use a public image.

---

## Verification

1. `bun run typecheck` — all packages pass
2. `bun run build` — all apps build
3. `bun run tf:validate` — Terraform validates with updated game-service module + new API module
4. Local dev: `bun run dev:web` + `bun run dev:api` with mock DynamoDB data
5. End-to-end: deploy, create a game instance, power on, verify boot stages advance, verify browser ping works via DNS

---

## Open Question: How to Handle Admin

The current auth model uses opaque tokens scoped to specific `gameInstanceIds`. This covers regular users accessing shared links, but doesn't address admin operations. Key decisions needed:

- **What makes someone an admin?** Options:
  - A token with a special `admin: true` flag or `permissions: ['admin']` field
  - A separate admin token type in DynamoDB (e.g., `entityType: 'AdminToken'`)
  - A hardcoded admin secret in environment variables (simplest, least flexible)

- **What can admins do that regular users can't?**
  - Create/revoke/list access tokens
  - Add/remove game instances from DynamoDB (or is that Terraform-only?)
  - View all servers regardless of token scope
  - Access audit logs

- **Admin API endpoints to design:**
  - `POST /api/admin/tokens` — create a new access token with scoped instance access
  - `DELETE /api/admin/tokens/:id` — revoke a token
  - `GET /api/admin/tokens` — list all tokens (redacted hashes)
  - `GET /api/admin/instances` — list all instances (not scoped by token)
  - Possibly: `POST /api/admin/instances` — register a new game instance in DynamoDB

- **Frontend admin section:**
  - Token management UI (create links, set expiry, revoke)
  - Full instance visibility
  - Should this be a separate route/page or a section within the dashboard?

- **Bootstrap problem:** How is the first admin token created? Options:
  - CLI tool / script that writes directly to DynamoDB
  - A one-time setup endpoint protected by an env-var secret
  - Seed data in Terraform (DynamoDB item resource)

---

## Open Question: Boot/Shutdown Failure UX

- What does the UI show when a stage fails? Options:
  - Terminal line turns red with error message (e.g., "Scaling infrastructure... FAILED: timeout after 180s")
  - A "Retry" button appears below the failed stage
  - The card switches to `error` status with a persistent indicator
- Should failed boots auto-rollback (scale ASG back to 0) or leave infrastructure up for debugging?
- How is `error` state visually distinct from `offline`? (red accent vs gray?)
- How does the user recover from `error`? Explicit "Retry" action, or just power off then on again?

---

## Decided: No Cancel Mid-Boot

Power sequences cannot be cancelled once started. The user must wait for completion or failure, then power off if needed.

---

## Open Question: Auto-Shutdown When Empty

- Should servers auto-shutdown after N minutes with 0 players? This saves costs when someone forgets to turn off.
- Configurable per-instance? (e.g., `autoShutdownAfterMinutes: 30`, `null` to disable)
- Where does the countdown live? Options:
  - Backend checks player count during status polls. If `players === 0` for N consecutive polls, trigger shutdown.
  - A DynamoDB field `emptyServerSince: ISO timestamp` — set when players drop to 0, cleared when players join.
  - The status poll compares `now - emptyServerSince > threshold` and auto-triggers `POST /power { action: 'off' }`.
- Frontend display: show a warning/countdown on the card? (e.g., "Auto-shutdown in 12 min — no players")

---

## Open Question: Empty State

- What does the dashboard show when the user's token grants access to zero servers?
- Options:
  - Friendly illustration + "No servers available" message
  - If the token is valid but has no instances: "You don't have access to any servers. Ask your admin for a new link."
  - If the token itself is invalid/expired: redirect to the unauthed screen (see below)

---

## Decided: Auth Flow

- **Token delivery**: Magic URL format is `/t/<token>`. When the user visits this URL, the frontend extracts the token and persists it to `localStorage`.
- **Subsequent visits**: The frontend checks `localStorage` for the token. If present, uses it for API calls. The user can bookmark the bare dashboard URL after first visit.
- **Token in API calls**: Sent as `Authorization: Bearer <token>` header.

---

## TODO: Unauthed Screen

Design and implement an unauthenticated landing screen shown when:
- No token in `localStorage` and no `/t/<token>` in the URL
- Token is expired or revoked (API returns 401)
- Token has been removed from `localStorage`

This screen should:
- Explain what the app is (briefly)
- Tell the user they need an access link
- Provide a way to paste/enter a token manually (optional, for power users)

---

## Decided: Latency Ping UX

- Show a **spinner** in the latency chip while the first ping is in-flight.
- If ping fails: hide the latency chip, let the "Network" health check reflect the issue.
- Pings only run when server status is `online` or during boot after the DNS stage completes.

---

## Decided: "Last Updated" Display

- Show "Last updated X ago" as a **tooltip/hover** on the status badge or server card header, not as permanent visible text.
- Keeps the UI clean while still being discoverable.
