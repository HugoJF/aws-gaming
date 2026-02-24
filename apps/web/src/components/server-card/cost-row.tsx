import type { CostComponent } from '@aws-gaming/contracts';

interface CostRowProps {
  component: CostComponent;
}

export function CostRow({ component }: CostRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs text-foreground">
          {component.label}
        </div>
        {component.detail && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {component.detail}
          </div>
        )}
      </div>
      <div className="shrink-0 font-mono text-[11px] text-muted-foreground">
        ${component.perHourUsd.toFixed(3)}/hr
      </div>
    </div>
  );
}
