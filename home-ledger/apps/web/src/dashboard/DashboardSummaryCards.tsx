import type { DashboardMetric } from "./dashboard-model";

export function DashboardSummaryCards({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="dashboard-summary-row" aria-label="Home records summary">
      {metrics.map((metric) => (
        <a className="dashboard-summary-link" href={metric.href} key={metric.label} title={metric.detail}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <em aria-hidden="true">View</em>
        </a>
      ))}
    </section>
  );
}
