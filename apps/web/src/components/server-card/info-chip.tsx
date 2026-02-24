import type React from 'react';
import { cn } from '@/lib/utils';

interface InfoChipProps {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}

export function InfoChip({ icon: Icon, value, mono, highlight }: InfoChipProps) {
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
