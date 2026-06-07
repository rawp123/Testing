export function EmptyState({ title, children }: { title: string; children: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}
