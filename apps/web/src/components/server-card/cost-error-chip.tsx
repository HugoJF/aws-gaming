import { DollarSign } from 'lucide-react';
import { getHttpErrorMessage } from '@/lib/api';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { InfoChip } from '@/components/server-card/info-chip';

interface CostErrorChipProps {
  error: unknown;
}

export function CostErrorChip({ error }: CostErrorChipProps) {
  const message = getHttpErrorMessage(error, 'Failed to load cost estimate');

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <InfoChip icon={DollarSign} value="Cost error" />
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[min(92vw,30rem)] max-w-[30rem] p-0"
        sideOffset={8}
      >
        <div className="border-b border-border px-3 py-2.5">
          <span className="text-xs font-medium text-foreground">
            Cost Estimate Failed
          </span>
        </div>
        <div className="px-3 py-2">
          <div className="text-[11px] text-muted-foreground break-words">
            {message}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
