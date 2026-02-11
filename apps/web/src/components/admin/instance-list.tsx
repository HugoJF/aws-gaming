import { cn } from '@/lib/utils';
import type { AdminInstanceView } from '@aws-gaming/contracts';
import { Badge } from '@/components/ui/badge';

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-400',
  offline: 'bg-zinc-500',
  booting: 'bg-amber-400 animate-pulse',
  'shutting-down': 'bg-amber-400 animate-pulse',
  error: 'bg-red-400',
};

interface InstanceListProps {
  instances: AdminInstanceView[];
}

export function InstanceList({ instances }: InstanceListProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {instances.length} instance{instances.length !== 1 && 's'} total
      </p>

      <div className="rounded-lg border bg-card divide-y divide-border">
        {instances.map((inst) => (
          <div
            key={inst.id}
            className="flex items-center gap-3 px-4 py-3 text-sm"
          >
            {/* Status dot */}
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[inst.status])}
            />

            {/* Name + game */}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-foreground">
                {inst.displayName}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">
                {inst.gameLabel}
              </span>
            </div>

            {/* Location */}
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {inst.location}
            </span>

            {/* Address */}
            <code className="hidden sm:inline text-xs font-mono text-muted-foreground">
              {inst.address}
            </code>

            {/* Status badge */}
            <Badge variant="outline" className="text-[10px] capitalize">
              {inst.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
