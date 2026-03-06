export default function SettingsLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="h-6 w-28 bg-[#E3E8EF] rounded animate-pulse mb-6" />
      {/* Tab bar skeleton */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "#E3E8EF" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-28 bg-[#E3E8EF] rounded-t animate-pulse" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="glass rounded-xl p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 bg-[#E3E8EF] rounded animate-pulse" />
            <div className="h-10 w-full bg-[#E3E8EF] rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
