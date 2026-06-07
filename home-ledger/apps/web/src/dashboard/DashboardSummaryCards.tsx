import type { DashboardMetric } from "./dashboard-model";

export function DashboardSummaryCards({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="dashboard-summary-row" aria-label="Workspace summary">
      {metrics.map((metric) => (
        <a className="dashboard-summary-link" href={metric.href} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <em>{metric.detail}</em>
        </a>
      ))}
    </section>
  );
}
