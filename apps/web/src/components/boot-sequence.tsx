import { useState } from 'react';
import { useInterval } from 'usehooks-ts';
import { cn } from '@/lib/utils';
import type { PowerStage } from '@aws-gaming/contracts';
import { StageRow } from '@/components/boot-sequence/stage-row';

interface BootSequenceProps {
  type: 'boot' | 'shutdown';
  stages: PowerStage[];
}

export function BootSequence({ type, stages }: BootSequenceProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useInterval(() => setNowMs(Date.now()), stages.length > 0 ? 1_000 : null);

  const isBoot = type === 'boot';
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const progressPercent =
    stages.length > 0 ? (completedCount / stages.length) * 100 : 0;
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
              nowMs={nowMs}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
