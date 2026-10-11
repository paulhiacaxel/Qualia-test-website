export function Aperture({ className = "" }: { className?: string }) {
  return (
    <div className={`aperture ${className}`} aria-hidden="true">
      <svg viewBox="-4 -4 108 108" fill="none">
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="27" stroke="currentColor" strokeWidth="1.6" />
        {Array.from({ length: 8 }, (_, index) => (
          <line
            key={index}
            x1="77"
            y1="50"
            x2="88"
            y2="50"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            transform={`rotate(${index * 45} 50 50)`}
          />
        ))}
      </svg>
    </div>
  );
}
