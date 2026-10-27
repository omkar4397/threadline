// The Threadline mark: three timeline bars woven together by one thread that
// ends in a needle. `compact` drops the needle and thickens the thread so it
// stays legible at icon sizes.

export function LogoMark({ size = 40, compact = false, onDark = false, className = "" }: { size?: number; compact?: boolean; onDark?: boolean; className?: string }) {
  const thread = onDark ? "#e58fa3" : "#a3445a";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} aria-hidden="true">
      <rect x="14" y="24" width="58" height="18" rx="9" fill="#f1b9c6" />
      <rect x="38" y="51" width="62" height="18" rx="9" fill="#bfd8bc" />
      <rect x="22" y="78" width="52" height="18" rx="9" fill="#e9d3a6" />
      <path d="M6 33 H70 C94 33 96 60 74 60 H44 C20 60 18 87 40 87 H92" fill="none" stroke={thread} strokeWidth={compact ? 7 : 4} strokeLinecap="round" />
      {compact ? null : (
        <>
          <path d="M88 84.5 H108 L117 87 L108 89.5 H88 Q85 87 88 84.5 Z" fill={onDark ? "#fbf4f1" : "#2e2427"} />
          <rect x="90.5" y="86" width="6" height="2" rx="1" fill={onDark ? "#2e2427" : "#fbf4f1"} />
        </>
      )}
    </svg>
  );
}

/** The lowercase wordmark, "thread" in ink and "line" in rose. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      thread<span className="text-accent">line</span>
    </span>
  );
}

export function Logo({ size = 36, textClassName = "text-xl" }: { size?: number; textClassName?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="Threadline" role="img">
      <LogoMark size={size} compact={size < 56} />
      <Wordmark className={textClassName} />
    </span>
  );
}
