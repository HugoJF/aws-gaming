import { cn } from '@/lib/utils';
import { Power } from 'lucide-react';

interface PowerToggleProps {
  isOn: boolean;
  isProcessing: boolean;
  isBooting: boolean;
  isShuttingDown: boolean;
  onToggle: () => void;
  disabled?: boolean;
  label: string;
}

export function PowerToggle({
  isOn,
  isProcessing,
  isBooting,
  isShuttingDown,
  onToggle,
  disabled,
  label,
}: PowerToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'group/power relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed',
        {
          // Off state
          'bg-secondary hover:bg-secondary/80':
            !isOn && !isProcessing && !isShuttingDown,
          // On state - glowing ring
          'bg-primary/15 ring-2 ring-primary/50 hover:ring-primary/70':
            isOn && !isProcessing,
          // Booting - pulsing
          'bg-primary/10 ring-2 ring-primary/30': isBooting,
          // Shutting down - red pulsing
          'bg-destructive/10 ring-2 ring-destructive/30': isShuttingDown,
        },
      )}
    >
      {/* Outer glow when on */}
      {isOn && !isProcessing && (
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-md transition-opacity" />
      )}

      {/* Spinning ring during processing */}
      {isProcessing && (
        <div
          className={cn(
            'absolute inset-[-2px] rounded-full border-2 border-transparent',
            'animate-spin',
            {
              'border-t-primary': isBooting,
              'border-t-destructive': isShuttingDown,
            },
          )}
        />
      )}

      {/* Power icon */}
      <Power
        className={cn(
          'relative h-4 w-4 transition-colors duration-300',
          {
            'text-muted-foreground group-hover/power:text-primary':
              !isOn && !isProcessing && !isShuttingDown,
            'text-primary': (isOn && !isProcessing) || isBooting,
            'text-destructive': isShuttingDown,
          },
        )}
        strokeWidth={2.5}
      />
    </button>
  );
}
