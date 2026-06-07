import type { ReactNode } from "react";

export interface FilterChip {
  value: string;
  label: string;
  count?: number;
}

export function FilterPanel({
  title = "Filters",
  children,
  clearLabel = "Clear filters",
  onClear,
  className = ""
}: {
  title?: string;
  children: ReactNode;
  clearLabel?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={["filter-panel", className].filter(Boolean).join(" ")}>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
      {onClear ? (
        <button className="inline-filter-button" onClick={onClear} type="button">{clearLabel}</button>
      ) : null}
    </div>
  );
}

export function FilterChipGroup({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: FilterChip[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="filter-chip-row" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={value === option.value ? "is-active" : ""}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}{typeof option.count === "number" ? <> <span>{option.count}</span></> : null}
        </button>
      ))}
    </div>
  );
}
