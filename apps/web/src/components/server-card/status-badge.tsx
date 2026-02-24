import type React from 'react';
import { Activity, CircleCheck, CircleX } from 'lucide-react';
import type {
  HealthCheck,
  HealthCheckStatus,
  ServerStatus,
} from '@aws-gaming/contracts';
import { cn } from '@/lib/utils';
import { useRelativeTime } from '@/hooks/use-relative-time';
import { Badge } from '@/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

const HEALTH_ICON: Record<
  HealthCheckStatus,
  React.ComponentType<{ className?: string }>
> = {
  healthy: CircleCheck,
  unhealthy: CircleX,
};

const HEALTH_COLOR: Record<HealthCheckStatus, string> = {
  healthy: 'text-primary',
  unhealthy: 'text-destructive',
};

const HEALTH_DOT_COLOR: Record<HealthCheckStatus, string> = {
  healthy: 'bg-primary',
  unhealthy: 'bg-destructive',
};

const STATUS_DOT_CLASS = {
  offline: 'bg-muted-foreground',
  error: 'bg-destructive',
  booting: 'bg-primary animate-pulse',
  'shutting-down': 'bg-destructive animate-pulse',
} satisfies Partial<Record<ServerStatus, string>>;

interface StatusBadgeProps {
  status: ServerStatus;
  healthChecks: HealthCheck[];
  overallHealth: HealthCheckStatus;
  lastUpdatedAt?: string;
}

export function getOverallHealth(checks: HealthCheck[]): HealthCheckStatus {
  return checks.length > 0 && checks.every((check) => check.status === 'healthy')
    ? 'healthy'
    : 'unhealthy';
}

function getBadgeLabel(
  status: ServerStatus,
  overallHealth: HealthCheckStatus,
): string {
  if (status === 'booting') return 'Booting';
  if (status === 'shutting-down') return 'Stopping';
  if (status === 'offline') return 'Offline';
  if (status === 'error') return 'Error';
  return overallHealth === 'unhealthy' ? 'Unhealthy' : 'Healthy';
}

function getStatusDotClass(
  status: ServerStatus,
  overallHealth: HealthCheckStatus,
): string {
  if (status === 'online') {
    return HEALTH_DOT_COLOR[overallHealth];
  }

  return STATUS_DOT_CLASS[status] ?? 'bg-destructive animate-pulse';
}

export function StatusBadge({
  status,
  healthChecks,
  overallHealth,
  lastUpdatedAt,
}: StatusBadgeProps) {
  const relativeTime = useRelativeTime(lastUpdatedAt);
  const hasChecks =
    (status === 'online' || status === 'offline' || status === 'error') &&
    healthChecks.length > 0;

  const dotColor = getStatusDotClass(status, overallHealth);
  const needsAttention = status === 'online' && overallHealth === 'unhealthy';
  const issueCount = healthChecks.filter((check) => check.status !== 'healthy').length;
  const label = getBadgeLabel(status, overallHealth);

  const badge = (
    <Badge
      className={cn(
        'gap-1.5 border-0 px-2.5 py-0.5 text-xs font-medium transition-colors',
        {
          'bg-primary/10 text-primary':
            (status === 'online' && overallHealth !== 'unhealthy') || status === 'booting',
          'bg-destructive/10 text-destructive':
            (status === 'online' && overallHealth === 'unhealthy') ||
            status === 'error' ||
            status === 'shutting-down',
          'bg-secondary text-muted-foreground': status === 'offline',
          'cursor-default': hasChecks,
        },
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
      {needsAttention && (
        <span className="ml-0.5 text-[10px] text-destructive opacity-60">
          {`- ${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
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
          {healthChecks.map((check) => {
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
