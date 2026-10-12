export default function Loading() {
  return (
    <div className="loading-page" aria-label="Chargement" aria-busy="true">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-subtitle" />
      <div className="kpi-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton skeleton-card" />
        ))}
      </div>
      <div className="skeleton skeleton-chart" />
    </div>
  );
}
