import { cn, formatRelativeDate } from '@/lib/utils';
import type {
  AdminInstanceView,
  AdminTokenView,
  GameType,
  TokenStatus,
} from '@aws-gaming/contracts';
import { Badge } from '@/components/ui/badge';
import { Ban, Pencil } from 'lucide-react';

const GAME_COLORS: Record<GameType, string> = {
  minecraft: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  zomboid: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  generic: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
};

const STATUS_STYLES: Record<TokenStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  revoked: 'bg-red-500/10 text-red-400 border-red-500/20',
  expired: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

interface TokenRowProps {
  token: AdminTokenView;
  instances: AdminInstanceView[];
  onRevoke: (id: string) => Promise<void>;
  onEdit: (token: AdminTokenView) => void;
}

export function TokenRow({ token, instances, onRevoke, onEdit }: TokenRowProps) {
  const isInactive = token.status !== 'active';

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-colors',
        isInactive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {token.label}
            </span>
            <Badge
              className={cn(
                'text-[10px] px-1.5 py-0',
                STATUS_STYLES[token.status],
              )}
            >
              {token.status}
            </Badge>
            {token.isAdmin && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                admin
              </Badge>
            )}
          </div>

          <p className="mt-0.5 text-xs font-mono text-muted-foreground">
            {token.tokenPrefix}...
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {token.instanceIds.map((instId) => {
              const instance = instances.find((entry) => entry.id === instId);
              const game = instance?.game;
              return (
                <span
                  key={instId}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    game ? GAME_COLORS[game] : 'bg-muted text-muted-foreground',
                  )}
                >
                  {instance?.displayName ?? instId}
                </span>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">
              Created {formatRelativeDate(token.createdAt)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {token.revokedAt
                ? `Revoked ${formatRelativeDate(token.revokedAt)}`
                : token.expiresAt
                  ? `Expires ${formatRelativeDate(token.expiresAt)}`
                  : 'Never expires'}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {token.status === 'active' && (
              <button
                onClick={() => onEdit(token)}
                title="Edit token"
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}

            {token.status === 'active' && (
              <button
                onClick={() => {
                  void onRevoke(token.id);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Ban className="h-3 w-3" />
                Revoke
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
