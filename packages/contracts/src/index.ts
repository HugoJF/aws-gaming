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

export type HealthCheckStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

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
/*  Power Action / Boot & Shutdown Stages                              */
/* ------------------------------------------------------------------ */

export type BootStageId =
  | 'scaling'
  | 'registering'
  | 'starting'
  | 'dns_update'
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
}

export interface PowerAction {
  action: 'on' | 'off';
  stages: PowerStage[];
  currentStageId: PowerStageId;
  startedAt: string;
  deadlineAt: string;
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
  powerAction: PowerAction | null;
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

  /* Runtime state (optional; computed from AWS + cache when absent) */
  state?: ServerStatus;
  powerAction?: PowerAction;
  cachedStatus?: CachedServerStatus;
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

export interface PowerRequest {
  action: 'on' | 'off';
}

export interface PowerResponse {
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

export interface AdminInstanceView {
  id: string;
  displayName: string;
  game: GameType;
  gameLabel: string;
  location: string;
  status: ServerStatus;
  address: string;
  maxPlayers: number;
}

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
  | 'PowerAction'
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
  { id: 'game_ready', label: 'Waiting for game process health' },
  { id: 'ready', label: 'Server ready for players' },
] as const;

export const SHUTDOWN_STAGES: readonly { id: ShutdownStageId; label: string }[] = [
  { id: 'stopping', label: 'Stopping ECS service tasks' },
  { id: 'dns_clear', label: 'Removing Route53 DNS record' },
  { id: 'scaling_down', label: 'Scaling EC2 Auto Scaling Group to zero' },
  { id: 'draining', label: 'Waiting for Auto Scaling Group drain' },
  { id: 'stopped', label: 'Server fully offline' },
] as const;
