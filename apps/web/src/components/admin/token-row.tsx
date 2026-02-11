import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  instanceName,
  instanceGame,
  formatRelativeDate,
  type AdminTokenView,
} from '@/lib/mock-admin-data';
import { tokenShareUrl } from '@/hooks/use-mock-tokens';
import { Badge } from '@/components/ui/badge';
import { Ban, Check, Copy, Pencil } from 'lucide-react';

const GAME_COLORS: Record<string, string> = {
  minecraft: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  valheim: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  cs2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rust: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  ark: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  terraria: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  revoked: 'bg-red-500/10 text-red-400 border-red-500/20',
  expired: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

interface TokenRowProps {
  token: AdminTokenView;
  onRevoke: (id: string) => void;
  onEdit: (token: AdminTokenView) => void;
}

export function TokenRow({ token, onRevoke, onEdit }: TokenRowProps) {
  const [copied, setCopied] = useState(false);
  const isInactive = token.status !== 'active';

  function handleCopyUrl() {
    const fullUrl = `${window.location.origin}${tokenShareUrl(token)}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-colors',
        isInactive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: label + meta */}
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
          </div>

          <p className="mt-0.5 text-xs font-mono text-muted-foreground">
            {token.tokenPrefix}...
          </p>

          {/* Instance badges */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {token.instanceIds.map((instId) => {
              const game = instanceGame(instId);
              return (
                <span
                  key={instId}
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    game ? GAME_COLORS[game] : 'bg-muted text-muted-foreground',
                  )}
                >
                  {instanceName(instId)}
                </span>
              );
            })}
          </div>
        </div>

        {/* Right: dates + actions */}
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
            {/* Copy URL */}
            <button
              onClick={handleCopyUrl}
              title="Copy share URL"
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? 'Copied' : 'URL'}
            </button>

            {/* Edit (active only) */}
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

            {/* Revoke (active only) */}
            {token.status === 'active' && (
              <button
                onClick={() => onRevoke(token.id)}
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
