import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BootSequence, type Stage } from '@/components/boot-sequence';
import { PowerToggle } from '@/components/power-toggle';
import { useRelativeTime } from '@/hooks/use-relative-time';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card';
import {
  Globe,
  MapPin,
  Users,
  CircleCheck,
  CircleX,
  CircleMinus,
  Activity,
} from 'lucide-react';

export type ServerStatus = 'online' | 'offline' | 'booting' | 'shutting-down';

export type GameType =
  | 'minecraft'
  | 'valheim'
  | 'csgo'
  | 'rust'
  | 'ark'
  | 'terraria';

export type HealthCheckStatus = 'healthy' | 'unhealthy' | 'degraded';

export interface HealthCheck {
  name: string;
  status: HealthCheckStatus;
  latency?: string;
}

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
  valheim: {
    accentBorder: 'border-sky-400/20',
    accentGlow: 'bg-sky-400/5',
  },
  csgo: {
    accentBorder: 'border-amber-400/20',
    accentGlow: 'bg-amber-400/5',
  },
  rust: {
    accentBorder: 'border-orange-400/20',
    accentGlow: 'bg-orange-400/5',
  },
  ark: {
    accentBorder: 'border-violet-400/20',
    accentGlow: 'bg-violet-400/5',
  },
  terraria: {
    accentBorder: 'border-pink-400/20',
    accentGlow: 'bg-pink-400/5',
  },
};

export interface ServerData {
  id: string;
  name: string;
  game: GameType;
  gameLabel: string;
  ip: string;
  location: string;
  players: { current: number; max: number };
  status: ServerStatus;
  healthChecks?: HealthCheck[];
  latency?: number;
  lastUpdatedAt?: string;
}

interface ServerCardProps {
  server: ServerData;
  onStatusChange: (id: string, newStatus: ServerStatus) => void;
}

// Mock stage definitions for timer-based simulation.
// When the real API lands, stages come from server.powerAction.stages instead.
const MOCK_BOOT_STAGES = [
  { id: 'scaling', label: 'Scaling infrastructure', duration: 1200 },
  { id: 'registering', label: 'Registering to cluster', duration: 800 },
  { id: 'starting', label: 'Starting containers', duration: 1500 },
  { id: 'dns_update', label: 'Updating DNS', duration: 600 },
  { id: 'game_ready', label: 'Waiting for game', duration: 1800 },
  { id: 'ready', label: 'Server ready', duration: 400 },
];

const MOCK_SHUTDOWN_STAGES = [
  { id: 'stopping', label: 'Stopping containers', duration: 1200 },
  { id: 'dns_clear', label: 'Clearing DNS', duration: 400 },
  { id: 'draining', label: 'Draining instance', duration: 800 },
  { id: 'scaling_down', label: 'Scaling down', duration: 1000 },
  { id: 'stopped', label: 'Server stopped', duration: 300 },
];

function useMockStages(
  isActive: boolean,
  mockDefs: { id: string; label: string; duration: number }[],
  onComplete: () => void,
): Stage[] {
  const [stages, setStages] = useState<Stage[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!isActive) {
      setStages([]);
      return;
    }

    const initial: Stage[] = mockDefs.map((d, i) => ({
      id: d.id,
      label: d.label,
      status: i === 0 ? 'in_progress' : 'pending',
    }));
    setStages(initial);

    let currentIndex = 0;
    let timer: ReturnType<typeof setTimeout>;

    const advance = () => {
      setStages((prev) => {
        const next = prev.map((s, i) => {
          if (i === currentIndex) return { ...s, status: 'completed' as const };
          if (i === currentIndex + 1)
            return { ...s, status: 'in_progress' as const };
          return s;
        });
        return next;
      });
      currentIndex++;
      if (currentIndex < mockDefs.length) {
        timer = setTimeout(advance, mockDefs[currentIndex].duration);
      } else {
        onCompleteRef.current();
      }
    };

    timer = setTimeout(advance, mockDefs[0].duration);
    return () => clearTimeout(timer);
  }, [isActive, mockDefs]);

  return stages;
}

export function ServerCard({ server, onStatusChange }: ServerCardProps) {
  const isOnline = server.status === 'online';
  const isBooting = server.status === 'booting';
  const isShuttingDown = server.status === 'shutting-down';
  const isProcessing = isBooting || isShuttingDown;

  const gameConfig = GAME_CONFIG[server.game];

  const handleToggle = useCallback(() => {
    if (isProcessing) return;
    onStatusChange(server.id, isOnline ? 'shutting-down' : 'booting');
  }, [isProcessing, isOnline, server.id, onStatusChange]);

  const handleBootComplete = useCallback(() => {
    onStatusChange(server.id, 'online');
  }, [server.id, onStatusChange]);

  const handleShutdownComplete = useCallback(() => {
    onStatusChange(server.id, 'offline');
  }, [server.id, onStatusChange]);

  const bootStages = useMockStages(isBooting, MOCK_BOOT_STAGES, handleBootComplete);
  const shutdownStages = useMockStages(isShuttingDown, MOCK_SHUTDOWN_STAGES, handleShutdownComplete);
  const activeStages = isBooting ? bootStages : isShuttingDown ? shutdownStages : [];

  const overallHealth = getOverallHealth(server.healthChecks);

  return (
    <div
      className={cn(
        'group relative rounded-xl border bg-card transition-all duration-300',
        isOnline && gameConfig.accentBorder,
        server.status === 'offline' && 'border-border',
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
              {server.name}
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
              isBooting={isBooting}
              isShuttingDown={isShuttingDown}
              onToggle={handleToggle}
              label={`Toggle server ${server.name}`}
            />
          </div>
        </div>

        {/* Info chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <InfoChip
            icon={Users}
            value={
              isOnline
                ? `${server.players.current} / ${server.players.max}`
                : `${server.players.max} slots`
            }
            highlight={isOnline && server.players.current > 0}
          />
          <InfoChip icon={MapPin} value={server.location} />
          <InfoChip icon={Globe} value={server.ip} mono />
          {isOnline && server.latency != null && (
            <LatencyIndicator latency={server.latency} />
          )}
        </div>

        {/* Boot / Shutdown sequence */}
        {activeStages.length > 0 && (
          <BootSequence
            type={isBooting ? 'boot' : 'shutdown'}
            stages={activeStages}
          />
        )}
      </div>
    </div>
  );
}

/* -- Helpers -------------------------------------------------- */

function getOverallHealth(
  checks?: HealthCheck[],
): HealthCheckStatus | undefined {
  if (!checks || checks.length === 0) return undefined;
  if (checks.some((c) => c.status === 'unhealthy')) return 'unhealthy';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}

const HEALTH_ICON: Record<
  HealthCheckStatus,
  React.ComponentType<{ className?: string }>
> = {
  healthy: CircleCheck,
  degraded: CircleMinus,
  unhealthy: CircleX,
};

const HEALTH_COLOR: Record<HealthCheckStatus, string> = {
  healthy: 'text-primary',
  degraded: 'text-amber-400',
  unhealthy: 'text-destructive',
};

const HEALTH_DOT_COLOR: Record<HealthCheckStatus, string> = {
  healthy: 'bg-primary',
  degraded: 'bg-amber-400',
  unhealthy: 'bg-destructive',
};

function getBadgeLabel(
  status: ServerStatus,
  overallHealth?: HealthCheckStatus,
): string {
  if (status === 'booting') return 'Booting';
  if (status === 'shutting-down') return 'Stopping';
  if (status === 'offline') return 'Offline';
  if (!overallHealth || overallHealth === 'healthy') return 'Healthy';
  if (overallHealth === 'degraded') return 'Degraded';
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
  const relativeTime = useRelativeTime(lastUpdatedAt ?? null);
  const hasChecks =
    (status === 'online' || status === 'offline') &&
    healthChecks &&
    healthChecks.length > 0;

  const dotColor =
    status === 'online' && overallHealth
      ? HEALTH_DOT_COLOR[overallHealth]
      : status === 'online'
        ? 'bg-primary'
        : status === 'offline'
          ? 'bg-muted-foreground'
          : status === 'booting'
            ? 'bg-primary animate-pulse'
            : 'bg-destructive animate-pulse';

  const needsAttention =
    status === 'online' && overallHealth && overallHealth !== 'healthy';

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
        className="w-64 p-0"
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
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
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
                {check.latency && (
                  <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {check.latency}
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
