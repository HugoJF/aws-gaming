import type { AdminView } from '@/components/dashboard-header/types';
import { Stat } from '@/components/dashboard-header/stat';
import { ViewSwitcher } from '@/components/dashboard-header/view-switcher';

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
            <h1 className="text-lg font-semibold text-foreground">AWS Gaming</h1>
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
