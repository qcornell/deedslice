export default function AuditLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div className="h-3 w-64 bg-[#E3E8EF] rounded animate-pulse" />
        <div className="h-7 w-44 bg-[#E3E8EF] rounded-full animate-pulse" />
      </div>
      <div className="glass rounded-xl p-4 mb-6">
        <div className="h-10 w-full bg-[#E3E8EF] rounded-lg animate-pulse mb-3" />
        <div className="flex gap-6 pt-3 border-t" style={{ borderColor: "#E3E8EF" }}>
          <div className="h-3 w-24 bg-[#E3E8EF] rounded animate-pulse" />
          <div className="h-3 w-20 bg-[#E3E8EF] rounded animate-pulse" />
        </div>
      </div>
      <div className="glass rounded-xl p-6">
        <div className="h-5 w-40 bg-[#E3E8EF] rounded animate-pulse mb-6" />
        <div className="space-y-6 pl-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-[#E3E8EF] animate-pulse flex-shrink-0" />
              <div className="flex-1 rounded-lg bg-[#F6F9FC] border border-[#E3E8EF] p-4 space-y-2">
                <div className="h-4 w-32 bg-[#E3E8EF] rounded animate-pulse" />
                <div className="h-3 w-full bg-[#E3E8EF] rounded animate-pulse" />
                <div className="h-3 w-24 bg-[#E3E8EF] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
