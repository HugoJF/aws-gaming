import { cn } from '@/lib/utils';

interface SwitcherButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export function SwitcherButton({
  active,
  onClick,
  children,
}: SwitcherButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
