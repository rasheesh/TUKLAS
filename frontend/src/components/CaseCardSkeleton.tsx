export function CaseCardSkeleton() {
  return (
    <div className="shimmer-card case-card" aria-hidden="true">
      <div className="shimmer shimmer-card-img" />
      <div className="shimmer-card-body">
        <div className="shimmer shimmer-line shimmer-line-med" />
        <div className="shimmer shimmer-line shimmer-line-full" />
        <div className="shimmer shimmer-line shimmer-line-short" />
        <div className="shimmer shimmer-line shimmer-line-med" style={{ marginTop: '0.25rem' }} />
      </div>
    </div>
  );
}

export function CaseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="case-grid" aria-label="Loading cases" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <CaseCardSkeleton key={i} />
      ))}
    </div>
  );
}
