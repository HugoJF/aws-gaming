import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import type { CreateTokenResult } from '@/hooks/use-admin-tokens';

interface TokenCreatedBannerProps {
  result: CreateTokenResult;
  onDismiss: () => void;
}

export function TokenCreatedBanner({
  result,
  onDismiss,
}: TokenCreatedBannerProps) {
  const [copied, setCopied] = useState(false);

  const fullUrl = `${window.location.origin}${result.shareUrl}`;

  function handleCopy() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-4">
      <button
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-sm text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="text-sm font-semibold text-foreground">
        Token created: {result.token.label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this link. It won't be shown again.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono text-foreground">
          {fullUrl}
        </code>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
