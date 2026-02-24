import { DollarSign } from 'lucide-react';
import type { ServerHourlyCostEstimate } from '@aws-gaming/contracts';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { CostRow } from '@/components/server-card/cost-row';
import { InfoChip } from '@/components/server-card/info-chip';

interface CostChipProps {
  estimate: ServerHourlyCostEstimate;
  online: boolean;
}

export function CostChip({ estimate, online }: CostChipProps) {
  const value = online
    ? `$${estimate.onlinePerHourUsd.toFixed(3)}/hr`
    : `$${estimate.offlinePerHourUsd.toFixed(3)}/hr`;

  const breakdown = online ? estimate.breakdownOnline : estimate.breakdownOffline;

  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <InfoChip icon={DollarSign} value={value} mono />
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        className="w-[min(92vw,30rem)] max-w-[30rem] p-0"
        sideOffset={8}
      >
        <div className="border-b border-border px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">
              Hourly Cost Estimate
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {estimate.currency}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono">
              Online ${estimate.onlinePerHourUsd.toFixed(3)}/hr
            </span>
            <span className="font-mono">
              Offline ${estimate.offlinePerHourUsd.toFixed(3)}/hr
            </span>
          </div>
        </div>

        <div className="py-1">
          {breakdown.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No breakdown available.
            </div>
          ) : (
            breakdown.map((component) => (
              <CostRow key={component.id} component={component} />
            ))
          )}
        </div>

        {estimate.assumptions.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <div className="text-[11px] font-medium text-foreground">
              Assumptions
            </div>
            <div className="mt-1 space-y-1">
              {estimate.assumptions.slice(0, 3).map((assumption) => (
                <div key={assumption} className="text-[11px] text-muted-foreground">
                  {assumption}
                </div>
              ))}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
