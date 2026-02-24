/* ------------------------------------------------------------------ */
/*  Game Types                                                         */
/* ------------------------------------------------------------------ */

export type GameType =
  | 'minecraft'
  | 'zomboid'
  | 'generic';

export type ServerStatus =
  | 'online'
  | 'offline'
  | 'booting'
  | 'shutting-down'
  | 'error';

export type PowerAction = 'on' | 'off';

export type HealthCheckStatus = 'healthy' | 'unhealthy';

export interface HealthCheck {
  name: string;
  status: HealthCheckStatus;
  detail?: string;
  latency?: number;
}

export interface LiveData {
  players: number;
  maxPlayers: number;
  serverName: string;
  map: string | null;
}

/* ------------------------------------------------------------------ */
/*  Transition / Boot & Shutdown Stages                                */
/* ------------------------------------------------------------------ */

export type BootStageId =
  | 'scaling'
  | 'registering'
  | 'starting'
  | 'task_healthy'
  | 'dns_update'
  | 'dns_resolve'
  | 'game_ready'
  | 'ready';

export type ShutdownStageId =
  | 'stopping'
  | 'dns_clear'
  | 'draining'
  | 'scaling_down'
  | 'stopped';

export type PowerStageId = BootStageId | ShutdownStageId;

export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PowerStage {
  id: PowerStageId;
  label: string;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  /** Soft timeout marker. Visual cue only; stage can still complete later. */
  timedOutAt?: string;
  timedOutMessage?: string;
}

/** Persisted record tracking a user-initiated power transition.
 *  Only stores intent + which side-effect actions have been fired.
 *  Stage completion status is always computed from live AWS state. */
export interface TransitionIntent {
  action: PowerAction;
  /** Stage IDs whose action() side effects have been fired. */
  firedActions: PowerStageId[];
  startedAt: string;
  deadlineAt: string;
  /** Soft overall deadline marker. Visual cue only. */
  deadlineExceededAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Server View (API response shape)                                   */
/* ------------------------------------------------------------------ */

export interface ServerView {
  id: string;
  displayName: string;
  game: GameType;
  gameLabel: string;
  address: string;
  healthEndpoint: string | null;
  location: string;
  maxPlayers: number;
  status: ServerStatus;
  liveData: LiveData | null;
  healthChecks: HealthCheck[];
  /** Active user-initiated transition (null when no transition in progress). */
  transition: TransitionIntent | null;
  /** Always-computed stage checklist (empty when offline). */
  stages: PowerStage[];
  lastUpdatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Game Templates & Instances (DynamoDB entities)                     */
/* ------------------------------------------------------------------ */

export interface GameTemplate {
  id: string;
  displayName: string;
  gameType: GameType;
  containerImage: string;
  containerPorts: number[];
  queryPort?: number;
  defaultMaxPlayers: number;
}

export interface GameInstance {
  id: string;
  templateId: string;
  displayName: string;
  gameType: GameType;
  gameLabel: string;
  dnsName?: string;
  location: string;
  maxPlayers: number;

  /* Ports */
  hostPort: number;
  healthPort: number;
  queryPort?: number;

  /* AWS resource references */
  ecsClusterArn: string;
  ecsServiceName: string;
  autoScalingGroupName: string;
  route53ZoneId?: string;

  /* Desired counts */
  instanceCount: number;
  taskCount: number;

  /* User's desired power state. Status is always computed from AWS. */
  desiredState?: PowerAction;
}

/* ------------------------------------------------------------------ */
/*  Cached Status (DynamoDB entity)                                    */
/* ------------------------------------------------------------------ */

export interface CachedServerStatus {
  instanceId: string;
  status: ServerStatus;
  liveData: LiveData | null;
  publicIp?: string | null;
  healthChecks: HealthCheck[];
  fetchedAt: string;
  ttl: number;
}

/* ------------------------------------------------------------------ */
/*  Auth Tokens (DynamoDB entity)                                      */
/* ------------------------------------------------------------------ */

export interface SecretAccessToken {
  id: string;
  tokenHash: string;
  label?: string;
  gameInstanceIds: string[];
  expiresAt: string | null;
  isAdmin?: boolean;
  revokedAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  API Request / Response Types                                       */
/* ------------------------------------------------------------------ */

export interface ListServersResponse {
  servers: ServerView[];
}

export interface ServerStatusResponse {
  server: ServerView;
}

/* ------------------------------------------------------------------ */
/*  Cost Estimation                                                   */
/* ------------------------------------------------------------------ */

export interface CostComponent {
  id: string;
  label: string;
  perHourUsd: number;
  /** Human-readable detail string (not intended for parsing). */
  detail?: string;
}

export interface ServerHourlyCostEstimate {
  currency: 'USD';
  onlinePerHourUsd: number;
  offlinePerHourUsd: number;
  breakdownOnline: CostComponent[];
  breakdownOffline: CostComponent[];
  assumptions: string[];
  inputs: {
    awsRegion: string;
    pricingLocation: string;
    instanceType: string | null;
    instanceCount: number;
    spotMaxPriceUsdPerHour: number | null;
    ec2OnDemandUsdPerHour: number | null;
    ec2EffectiveUsdPerHour: number | null;
    efsFileSystemId: string | null;
    efsSizeGiB: number | null;
    efsOneZoneUsdPerGiBMonth: number | null;
    computedAt: string;
  };
}

export interface ServerCostResponse {
  serverId: string;
  estimate: ServerHourlyCostEstimate;
}

export interface ServerPingResponse {
  serverId: string;
  ok: boolean;
  /** Latency measured by the API when probing the server health sidecar. */
  latencyMs: number | null;
  statusCode?: number;
}

export interface TransitionRequest {
  action: PowerAction;
}

export interface TransitionResponse {
  server: ServerView;
}

export interface ErrorResponse {
  error: string;
  detail?: string;
}

/* ------------------------------------------------------------------ */
/*  Admin API Types                                                    */
/* ------------------------------------------------------------------ */

export type TokenStatus = 'active' | 'revoked' | 'expired';

export interface AdminTokenView {
  id: string;
  label: string;
  tokenPrefix: string;
  status: TokenStatus;
  instanceIds: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt?: string;
  isAdmin?: boolean;
}

export interface AdminServerView {
  id: string;
  displayName: string;
  game: GameType;
  gameLabel: string;
  location: string;
  status: ServerStatus;
  address: string;
  maxPlayers: number;
}

/** @deprecated Use AdminServerView */
export type AdminInstanceView = AdminServerView;

export interface MeResponse {
  tokenId: string;
  isAdmin: boolean;
  gameInstanceIds: string[];
}

export interface AdminListTokensResponse {
  tokens: AdminTokenView[];
}

export interface AdminCreateTokenRequest {
  label: string;
  instanceIds: string[];
  expiresAt: string | null;
  isAdmin?: boolean;
}

export interface AdminCreateTokenResponse {
  token: AdminTokenView;
  rawToken: string;
}

export interface AdminUpdateTokenRequest {
  label?: string;
  instanceIds?: string[];
  expiresAt?: string | null;
  isAdmin?: boolean;
}

export interface AdminUpdateTokenResponse {
  token: AdminTokenView;
}

export interface AdminRevokeTokenResponse {
  token: AdminTokenView;
}

export interface AdminListServersResponse {
  servers: AdminServerView[];
}

/** @deprecated Use AdminListServersResponse */
export interface AdminListInstancesResponse {
  instances: AdminInstanceView[];
}

export interface BootstrapStatusResponse {
  canBootstrap: boolean;
}

export interface BootstrapCreateAdminRequest {
  label?: string;
}

export interface BootstrapCreateAdminResponse {
  token: AdminTokenView;
  rawToken: string;
}

/* ------------------------------------------------------------------ */
/*  DynamoDB Entity Types (for repository layer)                       */
/* ------------------------------------------------------------------ */

export type EntityType =
  | 'GameTemplate'
  | 'GameInstance'
  | 'TransitionIntent'
  | 'CachedStatus'
  | 'SecretAccessToken';

export interface DynamoEntity {
  pk: string;
  sk: string;
  entityType: EntityType;
}

/* ------------------------------------------------------------------ */
/*  Boot / Shutdown Stage Definitions                                  */
/* ------------------------------------------------------------------ */

export const BOOT_STAGES: readonly { id: BootStageId; label: string }[] = [
  { id: 'scaling', label: 'Scaling EC2 Auto Scaling Group up' },
  { id: 'registering', label: 'Registering EC2 instance with ECS cluster' },
  { id: 'starting', label: 'Starting ECS service tasks' },
  { id: 'dns_update', label: 'Updating Route53 DNS record' },
  { id: 'dns_resolve', label: 'Waiting for DNS to resolve' },
  { id: 'task_healthy', label: 'Waiting for container health check' },
  { id: 'game_ready', label: 'Waiting for game query response' },
  { id: 'ready', label: 'Server ready for players' },
] as const;

export const SHUTDOWN_STAGES: readonly { id: ShutdownStageId; label: string }[] = [
  { id: 'stopping', label: 'Stopping ECS service tasks' },
  { id: 'dns_clear', label: 'Removing Route53 DNS record' },
  { id: 'scaling_down', label: 'Scaling EC2 Auto Scaling Group to zero' },
  { id: 'draining', label: 'Waiting for Auto Scaling Group drain' },
  { id: 'stopped', label: 'Server fully offline' },
] as const;
