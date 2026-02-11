import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMockTokens } from '@/hooks/use-mock-tokens';
import { TokenList } from './token-list';
import { InstanceList } from './instance-list';

type AdminTab = 'tokens' | 'instances';

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('tokens');
  const {
    tokens,
    instances,
    lastCreated,
    create,
    update,
    revoke,
    dismissCreatedBanner,
  } = useMockTokens();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Tab bar */}
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

      {/* Tab content */}
      {tab === 'tokens' ? (
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
