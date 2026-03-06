export default function PropertyLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="h-6 w-48 bg-[#E3E8EF] rounded animate-pulse mb-2" />
      <div className="h-3 w-64 bg-[#E3E8EF] rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-6">
            <div className="h-3 w-16 bg-[#E3E8EF] rounded animate-pulse mb-3" />
            <div className="h-7 w-24 bg-[#E3E8EF] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="glass rounded-xl p-6">
        <div className="h-5 w-28 bg-[#E3E8EF] rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="h-4 w-24 bg-[#E3E8EF] rounded animate-pulse" />
              <div className="h-4 w-32 bg-[#E3E8EF] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
