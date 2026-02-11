import { ServerOff } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
        <ServerOff className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">
        No servers available
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        You don't have access to any game servers. Ask your admin for an access
        link.
      </p>
    </div>
  );
}
