import { Check, Loader2, X } from 'lucide-react';
import type { StageStatus } from '@aws-gaming/contracts';
import { cn } from '@/lib/utils';

interface StageIconProps {
  status: StageStatus;
  isBoot: boolean;
}

export function StageIcon({ status, isBoot }: StageIconProps) {
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
