import { useMemo } from 'react';
import type { PowerStage } from '@aws-gaming/contracts';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/components/boot-sequence/format-duration';
import { StageIcon } from '@/components/boot-sequence/stage-icon';

interface StageRowProps {
  stage: PowerStage;
  isBoot: boolean;
  nowMs: number;
}

export function StageRow({ stage, isBoot, nowMs }: StageRowProps) {
  const durationLabel = useMemo(() => {
    if (!stage.startedAt) return null;
    const started = Date.parse(stage.startedAt);
    if (Number.isNaN(started)) return null;
    const ended = stage.completedAt ? Date.parse(stage.completedAt) : nowMs;
    const endMs = Number.isNaN(ended) ? nowMs : ended;
    const delta = Math.max(0, endMs - started);
    return formatDuration(delta);
  }, [nowMs, stage.completedAt, stage.startedAt]);

  const isTimedOut = !!stage.timedOutAt && stage.status !== 'completed';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded px-2 py-1 font-mono text-xs transition-all duration-300',
        {
          'text-muted-foreground': stage.status === 'completed',
          'text-primary': stage.status === 'in_progress' && isBoot,
          'text-destructive':
            (stage.status === 'in_progress' && !isBoot) ||
            stage.status === 'failed',
          'text-muted-foreground/40': stage.status === 'pending',
          'text-amber-400': isTimedOut,
        },
      )}
    >
      <StageIcon status={stage.status} isBoot={isBoot} />
      <span>{stage.label}</span>

      {stage.status === 'in_progress' && (
        <span className="inline-flex gap-0.5">
          <span className="animate-pulse">{'.'}</span>
          <span
            className="animate-pulse"
            style={{ animationDelay: '200ms' }}
          >
            {'.'}
          </span>
          <span
            className="animate-pulse"
            style={{ animationDelay: '400ms' }}
          >
            {'.'}
          </span>
        </span>
      )}

      {isTimedOut && (
        <span className="text-amber-400/80">
          ({stage.timedOutMessage ?? 'timed out'})
        </span>
      )}

      {stage.error && (
        <span
          className={cn(
            stage.status === 'failed'
              ? 'text-destructive/70'
              : 'text-amber-400/80',
          )}
        >
          ({stage.error})
        </span>
      )}

      {durationLabel && (
        <span className="ml-auto tabular-nums text-muted-foreground">
          {durationLabel}
        </span>
      )}
    </div>
  );
}
