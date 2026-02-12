import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AdminTokenView, AdminInstanceView } from '@aws-gaming/contracts';
import type {
  CreateTokenInput,
  CreateTokenResult,
  UpdateTokenInput,
} from '@/hooks/use-token-mutations';
import { TokenRow } from './token-row';
import { TokenCreatedBanner } from './token-created-banner';
import { CreateTokenDialog } from './create-token-dialog';
import { EditTokenDialog } from './edit-token-dialog';

interface TokenListProps {
  tokens: AdminTokenView[];
  instances: AdminInstanceView[];
  lastCreated: CreateTokenResult | null;
  onCreate: (input: CreateTokenInput) => Promise<void>;
  onUpdate: (tokenId: string, input: UpdateTokenInput) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onDismissBanner: () => void;
}

export function TokenList({
  tokens,
  instances,
  lastCreated,
  onCreate,
  onUpdate,
  onRevoke,
  onDismissBanner,
}: TokenListProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<AdminTokenView | null>(null);

  const activeTokens = tokens.filter((t) => t.status === 'active');
  const inactiveTokens = tokens.filter((t) => t.status !== 'active');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {activeTokens.length} active token{activeTokens.length !== 1 && 's'}
        </p>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Token
        </button>
      </div>

      {lastCreated && (
        <TokenCreatedBanner result={lastCreated} onDismiss={onDismissBanner} />
      )}

      <div className="space-y-2">
        {activeTokens.map((token) => (
          <TokenRow
            key={token.id}
            token={token}
            instances={instances}
            onRevoke={onRevoke}
            onEdit={setEditingToken}
          />
        ))}
      </div>

      {inactiveTokens.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
            {inactiveTokens.length} revoked / expired token
            {inactiveTokens.length !== 1 && 's'}
          </summary>
          <div className="mt-2 space-y-2">
            {inactiveTokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                instances={instances}
                onRevoke={onRevoke}
                onEdit={setEditingToken}
              />
            ))}
          </div>
        </details>
      )}

      <CreateTokenDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        instances={instances}
        onCreate={onCreate}
      />

      {editingToken && (
        <EditTokenDialog
          open={!!editingToken}
          onOpenChange={(open) => {
            if (!open) setEditingToken(null);
          }}
          token={editingToken}
          instances={instances}
          onSave={onUpdate}
        />
      )}
    </div>
  );
}
