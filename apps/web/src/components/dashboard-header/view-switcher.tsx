import type { AdminView } from '@/components/dashboard-header/types';
import { SwitcherButton } from '@/components/dashboard-header/switcher-button';

interface ViewSwitcherProps {
  current: AdminView;
  onChange: (view: AdminView) => void;
}

export function ViewSwitcher({ current, onChange }: ViewSwitcherProps) {
  return (
    <div className="flex rounded-md border border-border bg-muted/50 p-0.5">
      <SwitcherButton
        active={current === 'servers'}
        onClick={() => onChange('servers')}
      >
        Servers
      </SwitcherButton>
      <SwitcherButton
        active={current === 'admin'}
        onClick={() => onChange('admin')}
      >
        Admin
      </SwitcherButton>
    </div>
  );
}
