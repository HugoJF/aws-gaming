import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminTokensQuery } from '@/hooks/use-admin-tokens-query';
import { useTokenMutations } from '@/hooks/use-token-mutations';
import { useAdminServersQuery } from '@/hooks/use-admin-servers-query';
import { getHttpErrorMessage } from '@/lib/api';
import { TokenList } from './token-list';
import { InstanceList } from './instance-list';

type AdminTab = 'tokens' | 'instances';

interface AdminViewProps {
  token: string | null;
}

export function AdminView({ token }: AdminViewProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('tokens');
  const {
    tokens,
    loading: tokensLoading,
    error: tokensError,
  } = useAdminTokensQuery({ token });
  const {
    lastCreated,
    error: mutationsError,
    create,
    update,
    revoke,
    dismissCreatedBanner,
  } = useTokenMutations({ token });
  const {
    servers: instances,
    loading: serversLoading,
    error: serversError,
  } = useAdminServersQuery({ token });

  const loading = tokensLoading || serversLoading;
  const errorSource = tokensError ?? serversError ?? mutationsError;
  const error = errorSource
    ? getHttpErrorMessage(errorSource, 'Failed to load admin data')
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex gap-6 border-b border-border">
        <TabButton
          active={tab === 'tokens'}
          onClick={() => setTab('tokens')}
        >
          Access Tokens
        </TabButton>
        <TabButton
          active={tab === 'instances'}
          onClick={() => setTab('instances')}
        >
          All Instances
        </TabButton>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading admin data...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => void qc.invalidateQueries({ queryKey: ['admin', token] })}
            className="mt-3 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Retry
          </button>
        </div>
      ) : tab === 'tokens' ? (
        <TokenList
          tokens={tokens}
          instances={instances}
          lastCreated={lastCreated}
          onCreate={create}
          onUpdate={update}
          onRevoke={revoke}
          onDismissBanner={dismissCreatedBanner}
        />
      ) : (
        <InstanceList instances={instances} />
      )}
    </main>
  );
}

function TabButton({
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
        'pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
        active
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
