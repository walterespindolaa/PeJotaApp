const SkeletonCard = () => (
  <div className="rounded-xl border border-border/40 bg-card p-5 space-y-3 animate-pulse">
    <div className="h-3 w-24 bg-muted rounded" />
    <div className="h-7 w-32 bg-muted rounded" />
    <div className="h-2 w-full bg-muted rounded" />
  </div>
);

const DashboardSkeleton = () => (
  <div className="space-y-6 p-4 md:p-6">
    <div className="h-5 w-48 bg-muted rounded animate-pulse" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border/40 bg-card p-5 h-64 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded" />
      </div>
      <div className="rounded-xl border border-border/40 bg-card p-5 h-64 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded mb-4" />
        <div className="h-full bg-muted/50 rounded" />
      </div>
    </div>
  </div>
);

export default DashboardSkeleton;
