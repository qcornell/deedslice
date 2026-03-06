export default function DistributionsLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="h-6 w-36 bg-[#E3E8EF] rounded animate-pulse mb-2" />
      <div className="h-3 w-56 bg-[#E3E8EF] rounded animate-pulse mb-6" />
      <div className="glass rounded-xl p-6">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="w-10 h-10 rounded-lg bg-[#E3E8EF] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-[#E3E8EF] rounded animate-pulse" />
                <div className="h-3 w-28 bg-[#E3E8EF] rounded animate-pulse" />
              </div>
              <div className="h-6 w-16 bg-[#E3E8EF] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
