import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { BootSequence } from '@/components/boot-sequence';
import { PowerToggle } from '@/components/power-toggle';
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
  Globe,
  MapPin,
  Users,
  DollarSign,
  Loader2,
} from 'lucide-react';
import type {
  ServerView,
  GameType,
} from '@aws-gaming/contracts';
import { useServerCostQuery } from '@/hooks/use-server-cost-query';
import { CostChip } from '@/components/server-card/cost-chip';
import { CostErrorChip } from '@/components/server-card/cost-error-chip';
import { InfoChip } from '@/components/server-card/info-chip';
import { LatencyIndicator } from '@/components/server-card/latency-indicator';
import {
  StatusBadge,
  getOverallHealth,
} from '@/components/server-card/status-badge';

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
