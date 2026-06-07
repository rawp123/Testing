export function ErrorState({ message }: { message: string }) {
  return (
    <section className="panel status-panel error" role="alert">
      <p className="eyebrow">Dashboard</p>
      <h1>Dashboard unavailable</h1>
      <p>{message || "Try again in a moment."}</p>
    </section>
  );
}
