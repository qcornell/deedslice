export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="h-3 w-20 bg-[#E3E8EF] rounded animate-pulse mb-3" />
            <div className="h-8 w-28 bg-[#E3E8EF] rounded animate-pulse mb-2" />
            <div className="h-3 w-16 bg-[#E3E8EF] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="glass rounded-xl p-6">
        <div className="h-5 w-32 bg-[#E3E8EF] rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#E3E8EF] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-[#E3E8EF] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[#E3E8EF] rounded animate-pulse" />
              </div>
              <div className="h-4 w-20 bg-[#E3E8EF] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
