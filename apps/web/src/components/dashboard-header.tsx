import { cn } from '@/lib/utils';

type AdminView = 'servers' | 'admin';

interface DashboardHeaderProps {
  serverCount: number;
  onlineCount: number;
  isAdmin?: boolean;
  currentView?: AdminView;
  onViewChange?: (view: AdminView) => void;
}

export function DashboardHeader({
  serverCount,
  onlineCount,
  isAdmin,
  currentView,
  onViewChange,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-card/50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Title */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">ServerDeck</h1>
            <p className="text-xs text-muted-foreground">Game Panel</p>
          </div>

          {/* View switcher (admin only) */}
          {isAdmin && currentView && onViewChange && (
            <ViewSwitcher current={currentView} onChange={onViewChange} />
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          <Stat label="Servers" value={String(serverCount)} />
          <div className="h-4 w-px bg-border" />
          <Stat label="Online" value={String(onlineCount)} highlight />
        </div>
      </div>
    </header>
  );
}

function ViewSwitcher({
  current,
  onChange,
}: {
  current: AdminView;
  onChange: (view: AdminView) => void;
}) {
  return (
    <div className="flex rounded-md border border-border bg-muted/50 p-0.5">
      <SwitcherButton
        active={current === 'servers'}
        onClick={() => onChange('servers')}
      >
        Servers
      </SwitcherButton>
      <SwitcherButton
        active={current === 'admin'}
        onClick={() => onChange('admin')}
      >
        Admin
      </SwitcherButton>
    </div>
  );
}

function SwitcherButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? 'text-sm font-semibold text-primary'
            : 'text-sm font-semibold text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}
