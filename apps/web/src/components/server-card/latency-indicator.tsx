import { cn } from '@/lib/utils';

interface LatencyIndicatorProps {
  latency: number;
}

export function LatencyIndicator({ latency }: LatencyIndicatorProps) {
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
