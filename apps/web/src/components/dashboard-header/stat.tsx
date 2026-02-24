interface StatProps {
  label: string;
  value: string;
  highlight?: boolean;
}

export function Stat({ label, value, highlight }: StatProps) {
  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? 'text-sm font-semibold text-primary'
            : 'text-sm font-semibold text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}
