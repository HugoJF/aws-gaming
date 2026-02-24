import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAdminTokensQuery } from '@/hooks/use-admin-tokens-query';
import type {
  CreateTokenInput,
  UpdateTokenInput,
} from '@/hooks/token-mutations/types';
import { useCreateTokenMutation } from '@/hooks/use-create-token-mutation';
import { useUpdateTokenMutation } from '@/hooks/use-update-token-mutation';
import { useRevokeTokenMutation } from '@/hooks/use-revoke-token-mutation';
import { useAdminServersQuery } from '@/hooks/use-admin-servers-query';
import { getHttpErrorMessage } from '@/lib/api';
import { TokenList } from './token-list';
import { InstanceList } from './instance-list';
import { TabButton } from './tab-button';

type AdminTab = 'tokens' | 'instances';

interface AdminViewProps {
  token: string;
}

export function AdminView({ token }: AdminViewProps) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('tokens');
  const {
    tokens,
    loading: tokensLoading,
    error: tokensError,
  } = useAdminTokensQuery({ token });
  const createMutation = useCreateTokenMutation({ token });
  const updateMutation = useUpdateTokenMutation({ token });
  const revokeMutation = useRevokeTokenMutation({ token });
  const {
    servers: instances,
    loading: serversLoading,
    error: serversError,
  } = useAdminServersQuery({ token });

  const loading = tokensLoading || serversLoading;
  const mutationsError =
    createMutation.error ?? updateMutation.error ?? revokeMutation.error;
  const errorSource = tokensError ?? serversError ?? mutationsError;
  const error = errorSource
    ? getHttpErrorMessage(errorSource, 'Failed to load admin data')
    : null;

  async function handleCreate(input: CreateTokenInput): Promise<void> {
    await createMutation.mutateAsync(input);
  }

  async function handleUpdate(
    tokenId: string,
    input: UpdateTokenInput,
  ): Promise<void> {
    await updateMutation.mutateAsync({ tokenId, input });
  }

  async function handleRevoke(tokenId: string): Promise<void> {
    await revokeMutation.mutateAsync(tokenId);
  }

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
          lastCreated={createMutation.lastCreated}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onRevoke={handleRevoke}
          onDismissBanner={createMutation.dismissCreatedBanner}
        />
      ) : (
        <InstanceList instances={instances} />
      )}
    </main>
  );
}
