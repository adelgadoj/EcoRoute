export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="ecoLeaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2be08f" /><stop offset="1" stopColor="#0f9d63" />
        </linearGradient>
      </defs>
      <path d="M6 30C6 14 18 6 40 6c0 22-8 36-24 36-6 0-10-4-10-12z" fill="url(#ecoLeaf)" />
      <path d="M10 40C18 28 26 20 34 14" stroke="#061225" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
