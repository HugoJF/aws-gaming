import React from 'react';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BootSequence } from '@/components/boot-sequence';
import { PowerToggle } from '@/components/power-toggle';
import { useRelativeTime } from '@/hooks/use-relative-time';
import { useLatencyPing } from '@/hooks/use-latency-ping';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import {
  Globe,
  MapPin,
  Users,
  DollarSign,
  CircleCheck,
  CircleX,
  CircleMinus,
  CircleHelp,
  Activity,
  Loader2,
} from 'lucide-react';
import type {
  ServerView,
  ServerStatus,
  GameType,
  HealthCheck,
  HealthCheckStatus,
  CostComponent,
  ServerHourlyCostEstimate,
} from '@aws-gaming/contracts';
import { useServerCostQuery } from '@/hooks/use-server-cost-query';
import { ApiError } from '@/lib/api';

export type { ServerView };

const GAME_CONFIG: Record<
  GameType,
  {
    accentBorder: string;
    accentGlow: string;
  }
> = {
  minecraft: {
    accentBorder: 'border-emerald-400/20',
    accentGlow: 'bg-emerald-400/5',
  },
  zomboid: {
    accentBorder: 'border-amber-400/20',
    accentGlow: 'bg-amber-400/5',
  },
  generic: {
    accentBorder: 'border-sky-400/20',
    accentGlow: 'bg-sky-400/5',
  },
};

interface ServerCardProps {
  token: string | null;
  server: ServerView;
  onTogglePower: (serverId: string, action: 'on' | 'off') => void;
  powerPending?: boolean;
}

export function ServerCard({ token, server, onTogglePower, powerPending }: ServerCardProps) {
  const isOnline = server.status === 'online';
  const isBooting = server.status === 'booting';
  const isShuttingDown = server.status === 'shutting-down';
  const isError = server.status === 'error';
  const isTransitioning = isBooting || isShuttingDown;
  const isProcessing = isTransitioning || !!powerPending;

  const [confirmOpen, setConfirmOpen] = useState(false);

  const gameConfig = GAME_CONFIG[server.game];

  const { latency, pinging } = useLatencyPing({
    healthEndpoint: server.healthEndpoint,
    status: server.status,
  });

  const targetAction: 'on' | 'off' = server.status === 'offline' ? 'on' : 'off';

  const handleToggle = useCallback(() => {
    if (powerPending) return;
    if (isTransitioning) {
      setConfirmOpen(true);
      return;
    }
    onTogglePower(server.id, targetAction);
  }, [powerPending, isTransitioning, targetAction, server.id, onTogglePower]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onTogglePower(server.id, targetAction);
  }, [targetAction, server.id, onTogglePower]);

  const overallHealth = getOverallHealth(server.healthChecks);

  const stages = server.stages ?? [];

  const {
    estimate: costEstimate,
    loading: costLoading,
    error: costError,
  } = useServerCostQuery(token, server.id);

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all duration-300',
        isOnline && gameConfig.accentBorder,
        server.status === 'offline' && 'border-border',
        server.status === 'error' && 'border-destructive/30',
        isBooting && 'border-primary/30',
        isShuttingDown && 'border-destructive/30',
      )}
    >
      {isOnline && (
        <div
          className={cn(
            'pointer-events-none absolute -inset-px rounded-xl',
            gameConfig.accentGlow,
          )}
        />
      )}

      <div className="relative p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-foreground">
              {server.displayName}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {server.gameLabel}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge
              status={server.status}
              healthChecks={server.healthChecks}
              overallHealth={overallHealth}
              lastUpdatedAt={server.lastUpdatedAt}
            />
            <PowerToggle
              isOn={isOnline}
              isProcessing={isProcessing}
              isBooting={isBooting || (!!powerPending && !isOnline)}
              isShuttingDown={isShuttingDown || isError || (!!powerPending && isOnline)}
              disabled={!!powerPending}
              onToggle={handleToggle}
              label={`Toggle server ${server.displayName}`}
            />
          </div>
        </div>

        {/* Info chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <InfoChip
            icon={Users}
            value={
              isOnline && server.liveData
                ? `${server.liveData.players} / ${server.liveData.maxPlayers}`
                : `${server.maxPlayers} slots`
            }
            highlight={isOnline && (server.liveData?.players ?? 0) > 0}
          />
          <InfoChip icon={MapPin} value={server.location} />
          <InfoChip icon={Globe} value={server.address} mono />
          {costEstimate ? (
            <CostChip estimate={costEstimate} online={isOnline} />
          ) : costLoading ? (
            <div className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Cost</span>
            </div>
          ) : costError ? (
            <CostErrorChip error={costError} />
          ) : (
            <InfoChip icon={DollarSign} value="Cost n/a" />
          )}
          {isOnline && pinging && latency === null && (
            <div className="ml-auto flex items-center gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          )}
          {isOnline && latency !== null && (
            <LatencyIndicator latency={latency} />
          )}
        </div>

        {/* Boot / Shutdown sequence (always computed from AWS state) */}
        {stages.length > 0 && (
          <BootSequence
            type={isShuttingDown ? 'shutdown' : 'boot'}
            stages={stages}
          />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isBooting ? 'Server is already booting' : 'Server is already shutting down'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isBooting
                ? 'This server is currently booting up. Do you want to force a shutdown instead?'
                : 'This server is currently shutting down. Do you want to force the shutdown sequence to run again?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                isShuttingDown && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {isBooting ? 'Force shutdown' : 'Retry shutdown'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -- Helpers -------------------------------------------------- */

function CostChip({
  estimate,
  online,
}: {
  estimate: ServerHourlyCostEstimate;
  online: boolean;
}) {
  const value = online
    ? `$${estimate.onlinePerHourUsd.toFixed(3)}/hr`
    : `$${estimate.offlinePerHourUsd.toFixed(3)}/hr`;

  const breakdown = online ? estimate.breakdownOnline : estimate.breakdownOffline;

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <InfoChip icon={DollarSign} value={value} mono />
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[min(92vw,30rem)] max-w-[30rem] p-0"
        sideOffset={8}
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">
              Hourly Cost Estimate
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {estimate.currency}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">
              Online ${estimate.onlinePerHourUsd.toFixed(3)}/hr
            </span>
            <span className="font-mono">
              Offline ${estimate.offlinePerHourUsd.toFixed(3)}/hr
            </span>
          </div>
        </div>

        <div className="py-1">
          {breakdown.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No breakdown available.
            </div>
          ) : (
            breakdown.map((c) => <CostRow key={c.id} component={c} />)
          )}
        </div>

        {estimate.assumptions.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <div className="text-[11px] font-medium text-foreground">
              Assumptions
            </div>
            <div className="mt-1 space-y-1">
              {estimate.assumptions.slice(0, 3).map((a) => (
                <div key={a} className="text-[11px] text-muted-foreground">
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function CostErrorChip({ error }: { error: unknown }) {
  const message =
    error instanceof ApiError
      ? error.body.detail
        ? `${error.body.error}: ${error.body.detail}`
        : error.body.error
      : error instanceof Error
        ? error.message
        : String(error);

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <InfoChip icon={DollarSign} value="Cost error" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[min(92vw,30rem)] max-w-[30rem] p-0"
        sideOffset={8}
      >
        <div className="border-b border-border px-3 py-2.5">
          <span className="text-xs font-medium text-foreground">
            Cost Estimate Failed
          </span>
        </div>
        <div className="px-3 py-2">
          <div className="text-[11px] text-muted-foreground break-words">
            {message}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function CostRow({ component }: { component: CostComponent }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs text-foreground">
          {component.label}
        </div>
        {component.detail && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {component.detail}
          </div>
        )}
      </div>
      <div className="shrink-0 font-mono text-[11px] text-muted-foreground">
        ${component.perHourUsd.toFixed(3)}/hr
      </div>
    </div>
  );
}

function getOverallHealth(
  checks?: HealthCheck[],
): HealthCheckStatus | undefined {
  if (!checks || checks.length === 0) return undefined;
  if (checks.some((c) => c.status === 'unhealthy')) return 'unhealthy';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  if (checks.every((c) => c.status === 'unknown')) return 'unknown';
  return 'healthy';
}

const HEALTH_ICON: Record<
  HealthCheckStatus,
  React.ComponentType<{ className?: string }>
> = {
  healthy: CircleCheck,
  degraded: CircleMinus,
  unhealthy: CircleX,
  unknown: CircleHelp,
};

const HEALTH_COLOR: Record<HealthCheckStatus, string> = {
  healthy: 'text-primary',
  degraded: 'text-amber-400',
  unhealthy: 'text-destructive',
  unknown: 'text-muted-foreground',
};

const HEALTH_DOT_COLOR: Record<HealthCheckStatus, string> = {
  healthy: 'bg-primary',
  degraded: 'bg-amber-400',
  unhealthy: 'bg-destructive',
  unknown: 'bg-muted-foreground',
};

function getBadgeLabel(
  status: ServerStatus,
  overallHealth?: HealthCheckStatus,
): string {
  if (status === 'booting') return 'Booting';
  if (status === 'shutting-down') return 'Stopping';
  if (status === 'offline') return 'Offline';
  if (status === 'error') return 'Error';
  if (overallHealth === 'healthy') return 'Healthy';
  if (overallHealth === 'degraded') return 'Degraded';
  if (overallHealth === 'unknown') return 'Unknown';
  return 'Unhealthy';
}

/* -- Status Badge with Health HoverCard ----------------------- */

function StatusBadge({
  status,
  healthChecks,
  overallHealth,
  lastUpdatedAt,
}: {
  status: ServerStatus;
  healthChecks?: HealthCheck[];
  overallHealth?: HealthCheckStatus;
  lastUpdatedAt?: string;
}) {
  const relativeTime = useRelativeTime(lastUpdatedAt);
  const hasChecks =
    (status === 'online' || status === 'offline' || status === 'error') &&
    healthChecks &&
    healthChecks.length > 0;

  const dotColor =
    status === 'online' && overallHealth
      ? HEALTH_DOT_COLOR[overallHealth]
      : status === 'online'
        ? 'bg-primary'
        : status === 'offline'
          ? 'bg-muted-foreground'
          : status === 'error'
            ? 'bg-destructive'
            : status === 'booting'
              ? 'bg-primary animate-pulse'
              : 'bg-destructive animate-pulse';

  const needsAttention =
    status === 'online' &&
    overallHealth &&
    overallHealth !== 'healthy' &&
    overallHealth !== 'unknown';

  const label = getBadgeLabel(status, overallHealth);

  const badge = (
    <Badge
      className={cn(
        'gap-1.5 border-0 px-2.5 py-0.5 text-xs font-medium transition-colors',
        status === 'online' &&
          overallHealth === 'healthy' &&
          'bg-primary/10 text-primary',
        status === 'online' &&
          overallHealth === 'degraded' &&
          'bg-amber-400/10 text-amber-400',
        status === 'online' &&
          overallHealth === 'unhealthy' &&
          'bg-destructive/10 text-destructive',
        status === 'online' && !overallHealth && 'bg-primary/10 text-primary',
        status === 'offline' && 'bg-secondary text-muted-foreground',
        status === 'error' && 'bg-destructive/10 text-destructive',
        status === 'booting' && 'bg-primary/10 text-primary',
        status === 'shutting-down' && 'bg-destructive/10 text-destructive',
        hasChecks && 'cursor-default',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          dotColor,
          needsAttention && 'animate-pulse',
        )}
      />
      {label}
      {needsAttention && healthChecks && (
        <span
          className={cn(
            'ml-0.5 text-[10px] opacity-60',
            overallHealth === 'degraded' && 'text-amber-400',
            overallHealth === 'unhealthy' && 'text-destructive',
          )}
        >
          {`- ${healthChecks.filter((c) => c.status !== 'healthy').length} issue${healthChecks.filter((c) => c.status !== 'healthy').length !== 1 ? 's' : ''}`}
        </span>
      )}
    </Badge>
  );

  if (!hasChecks) return badge;

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>{badge}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="end"
        className="w-[min(92vw,30rem)] max-w-[30rem] p-0"
        sideOffset={8}
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">
              Health Checks
            </span>
          </div>
        </div>
        <div className="py-1">
          {healthChecks!.map((check) => {
            const Icon = HEALTH_ICON[check.status];
            return (
              <div
                key={check.name}
                className="flex items-start justify-between gap-2 px-3 py-2"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 shrink-0',
                      HEALTH_COLOR[check.status],
                    )}
                  />
                  <span className="truncate text-xs text-foreground">
                    {check.name}
                  </span>
                </div>
                {check.detail && (
                  <span className="min-w-0 max-w-[18rem] text-right font-mono text-[11px] leading-tight text-muted-foreground break-words">
                    {check.detail}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {relativeTime && (
          <div className="border-t border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">
              Updated {relativeTime}
            </span>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

/* -- Latency Indicator ---------------------------------------- */

function LatencyIndicator({ latency }: { latency: number }) {
  const color =
    latency < 50
      ? 'text-primary bg-primary/10'
      : latency < 150
        ? 'text-amber-400 bg-amber-400/10'
        : 'text-destructive bg-destructive/10';

  const dotColor =
    latency < 50
      ? 'bg-primary'
      : latency < 150
        ? 'bg-amber-400'
        : 'bg-destructive';

  return (
    <div
      className={cn(
        'ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs',
        color,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColor)} />
      {latency}ms
    </div>
  );
}

/* -- Info Chip ------------------------------------------------ */

function InfoChip({
  icon: Icon,
  value,
  mono,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1.5 text-xs',
        highlight ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className={cn(mono && 'font-mono')}>{value}</span>
    </div>
  );
}
