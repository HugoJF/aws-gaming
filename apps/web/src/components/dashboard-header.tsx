interface DashboardHeaderProps {
  serverCount: number;
  onlineCount: number;
}

export function DashboardHeader({
  serverCount,
  onlineCount,
}: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-card/50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Title */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">ServerDeck</h1>
          <p className="text-xs text-muted-foreground">Game Panel</p>
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
