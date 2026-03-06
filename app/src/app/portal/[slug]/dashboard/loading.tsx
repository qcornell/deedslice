export default function PortalDashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Portfolio stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border p-5"
            style={{ background: "var(--lp-card-bg, #fff)", borderColor: "var(--lp-border, #E2E8F0)" }}
          >
            <div className="h-3 w-16 rounded animate-pulse mb-2" style={{ background: "#E2E8F0" }} />
            <div className="h-7 w-24 rounded animate-pulse" style={{ background: "#E2E8F0" }} />
          </div>
        ))}
      </div>
      {/* Properties skeleton */}
      <div
        className="rounded-xl border p-6"
        style={{ background: "var(--lp-card-bg, #fff)", borderColor: "var(--lp-border, #E2E8F0)" }}
      >
        <div className="h-5 w-32 rounded animate-pulse mb-5" style={{ background: "#E2E8F0" }} />
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3" style={{ borderColor: "var(--lp-border, #E2E8F0)" }}>
              <div className="h-4 w-40 rounded animate-pulse" style={{ background: "#E2E8F0" }} />
              <div className="flex gap-6">
                <div className="h-3 w-20 rounded animate-pulse" style={{ background: "#E2E8F0" }} />
                <div className="h-3 w-20 rounded animate-pulse" style={{ background: "#E2E8F0" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
