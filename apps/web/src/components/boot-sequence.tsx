import { cn } from '@/lib/utils';
import { Check, Loader2, X } from 'lucide-react';
import type { PowerStage, StageStatus } from '@aws-gaming/contracts';

export type { PowerStage as Stage };

interface BootSequenceProps {
  type: 'boot' | 'shutdown';
  stages: PowerStage[];
}

export function BootSequence({ type, stages }: BootSequenceProps) {
  if (stages.length === 0) return null;

  const isBoot = type === 'boot';
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const progressPercent = (completedCount / stages.length) * 100;
  const hasFailed = stages.some((s) => s.status === 'failed');

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background/50">
      {/* Terminal-style header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-[hsl(45,80%,50%)]/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-primary/60" />
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {isBoot ? 'boot-sequence' : 'shutdown-sequence'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-secondary">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            hasFailed
              ? 'bg-destructive'
              : isBoot
                ? 'bg-primary'
                : 'bg-destructive',
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stage list */}
      <div className="p-3">
        <div className="flex flex-col gap-1.5">
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              isBoot={isBoot}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageRow({
  stage,
  isBoot,
}: {
  stage: PowerStage;
  isBoot: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded px-2 py-1 font-mono text-xs transition-all duration-300',
        stage.status === 'completed' && 'text-muted-foreground',
        stage.status === 'in_progress' &&
          (isBoot ? 'text-primary' : 'text-destructive'),
        stage.status === 'pending' && 'text-muted-foreground/40',
        stage.status === 'failed' && 'text-destructive',
      )}
    >
      {/* Status icon */}
      <StageIcon status={stage.status} isBoot={isBoot} />

      {/* Stage label */}
      <span>{stage.label}</span>

      {/* Error detail */}
      {stage.status === 'failed' && stage.error && (
        <span className="ml-1 text-destructive/70">({stage.error})</span>
      )}

      {/* Inline loading dots for current stage */}
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
    </div>
  );
}

function StageIcon({
  status,
  isBoot,
}: {
  status: StageStatus;
  isBoot: boolean;
}) {
  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center">
      {status === 'completed' && (
        <Check
          className={cn(
            'h-3.5 w-3.5',
            isBoot ? 'text-primary' : 'text-destructive',
          )}
        />
      )}
      {status === 'in_progress' && (
        <Loader2
          className={cn(
            'h-3.5 w-3.5 animate-spin',
            isBoot ? 'text-primary' : 'text-destructive',
          )}
        />
      )}
      {status === 'pending' && (
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
      )}
      {status === 'failed' && (
        <X className="h-3.5 w-3.5 text-destructive" />
      )}
    </div>
  );
}
