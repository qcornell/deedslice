"use client";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto py-20 text-center">
      <div
        className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(223,27,65,0.08)" }}
      >
        <svg width="32" height="32" fill="none" stroke="#DF1B41" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--lp-text, #0F172A)" }}>
        Something went wrong
      </h2>
      <p className="text-[14px] mb-6" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-[14px] font-medium transition-all"
        style={{ background: "var(--lp-primary, #0D9488)" }}
      >
        Try Again
      </button>
    </div>
  );
}
